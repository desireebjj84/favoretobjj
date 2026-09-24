
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','instructor','parent');
CREATE TYPE public.belt_color AS ENUM ('white','grey','yellow','orange','green','blue','purple','brown','black');
CREATE TYPE public.attendance_status AS ENUM ('present','absent','late');
CREATE TYPE public.class_kind AS ENUM ('adult','kids');

-- UPDATED AT HELPER
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','instructor'));
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "profiles readable by staff or self" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- NEW USER TRIGGER: profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- LOCATIONS
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Miami, FL',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations readable" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage locations" ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- STUDENTS
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  birth_date DATE,
  is_minor BOOLEAN NOT NULL DEFAULT false,
  belt public.belt_color NOT NULL DEFAULT 'white',
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id UUID,
  qr_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8),'hex'),
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "students readable" ON public.students FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR guardian_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "staff manage students" ON public.students FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_view_student(_student_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff(auth.uid())
      OR EXISTS (SELECT 1 FROM public.students s
                 WHERE s.id = _student_id AND (s.guardian_id = auth.uid() OR s.user_id = auth.uid()));
$$;

-- CLASSES
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.class_kind NOT NULL DEFAULT 'adult',
  weekday INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INT NOT NULL DEFAULT 20,
  instructor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  instructor_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "classes readable" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SESSIONS
CREATE TABLE public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, session_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions readable" ON public.class_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage sessions" ON public.class_sessions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ATTENDANCE
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status public.attendance_status NOT NULL DEFAULT 'present',
  method TEXT NOT NULL DEFAULT 'manual',
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID,
  UNIQUE (session_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance readable" ON public.attendance FOR SELECT TO authenticated
  USING (public.can_view_student(student_id));
CREATE POLICY "staff manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- BRANDING
CREATE TABLE public.org_settings (
  id INT PRIMARY KEY DEFAULT 1,
  org_name TEXT NOT NULL DEFAULT 'Favoreto BJJ',
  accent_color TEXT NOT NULL DEFAULT '#E0422E',
  logo_url TEXT,
  default_language TEXT NOT NULL DEFAULT 'en',
  absence_threshold INT NOT NULL DEFAULT 2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_settings_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.org_settings TO authenticated;
GRANT ALL ON public.org_settings TO service_role;
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.org_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins update settings" ON public.org_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.org_settings (id) VALUES (1);

-- SESSION GENERATOR
CREATE OR REPLACE FUNCTION public.ensure_sessions(_from DATE, _to DATE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.class_sessions (class_id, session_date)
  SELECT c.id, d::date
  FROM public.classes c
  CROSS JOIN generate_series(_from, _to, interval '1 day') d
  WHERE c.active AND EXTRACT(DOW FROM d)::int = c.weekday
  ON CONFLICT (class_id, session_date) DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_sessions(DATE, DATE) TO authenticated;

-- SEED LOCATIONS
INSERT INTO public.locations (id, name, short_name, sort_order) VALUES
 ('11111111-1111-1111-1111-111111111111','Brickell','Brickell',1),
 ('22222222-2222-2222-2222-222222222222','Coconut Grove','C. Grove',2),
 ('33333333-3333-3333-3333-333333333333','Hialeah','Hialeah',3);

-- SEED CLASSES
INSERT INTO public.classes (location_id, name, kind, weekday, start_time, end_time, capacity, instructor_name) VALUES
 ('11111111-1111-1111-1111-111111111111','Fundamentals','adult',1,'18:00','19:00',18,'Prof. Rafael Silva'),
 ('11111111-1111-1111-1111-111111111111','No-Gi','adult',2,'19:00','20:00',18,'Prof. Rafael Silva'),
 ('11111111-1111-1111-1111-111111111111','Kids 5-8','kids',3,'17:00','17:45',12,'Prof. Marina Costa'),
 ('11111111-1111-1111-1111-111111111111','Competition Training','adult',6,'09:00','10:30',16,'Prof. Rafael Silva'),
 ('11111111-1111-1111-1111-111111111111','No-Gi','adult',4,'19:00','20:00',18,'Prof. Rafael Silva'),
 ('22222222-2222-2222-2222-222222222222','Fundamentals','adult',2,'18:30','19:30',16,'Prof. Joao Reis'),
 ('22222222-2222-2222-2222-222222222222','Kids 9-12','kids',3,'16:30','17:15',14,'Prof. Joao Reis'),
 ('22222222-2222-2222-2222-222222222222','Advanced Gi','adult',5,'19:00','20:15',16,'Prof. Joao Reis'),
 ('33333333-3333-3333-3333-333333333333','Fundamentals','adult',1,'19:00','20:00',20,'Prof. Marina Costa'),
 ('33333333-3333-3333-3333-333333333333','Kids 5-8','kids',2,'17:00','17:45',12,'Prof. Marina Costa'),
 ('33333333-3333-3333-3333-333333333333','No-Gi','adult',4,'20:00','21:00',20,'Prof. Marina Costa'),
 ('33333333-3333-3333-3333-333333333333','Open Mat','adult',6,'10:00','11:30',24,'Prof. Marina Costa');

-- SEED STUDENTS
INSERT INTO public.students (full_name, birth_date, is_minor, belt, location_id) VALUES
 ('Mateus Ferreira','1992-04-11',false,'brown','11111111-1111-1111-1111-111111111111'),
 ('Sofia Duarte','1996-09-02',false,'blue','11111111-1111-1111-1111-111111111111'),
 ('Lucas Almeida','1990-01-23',false,'purple','11111111-1111-1111-1111-111111111111'),
 ('Beatriz Nogueira','1994-07-30',false,'brown','11111111-1111-1111-1111-111111111111'),
 ('Diego Fuentes','1988-12-05',false,'black','11111111-1111-1111-1111-111111111111'),
 ('Camila Rocha','2016-03-18',true,'grey','11111111-1111-1111-1111-111111111111'),
 ('Tomas Herrera','2017-06-09',true,'grey','11111111-1111-1111-1111-111111111111'),
 ('Ana Paula Menezes','1999-11-14',false,'blue','22222222-2222-2222-2222-222222222222'),
 ('Ricardo Lima','1985-02-27',false,'black','22222222-2222-2222-2222-222222222222'),
 ('Valentina Cruz','2013-08-21',true,'yellow','22222222-2222-2222-2222-222222222222'),
 ('Pedro Barbosa','2001-05-16',false,'white','22222222-2222-2222-2222-222222222222'),
 ('Isabela Santos','1997-10-03',false,'purple','33333333-3333-3333-3333-333333333333'),
 ('Gabriel Moreira','1993-03-07',false,'brown','33333333-3333-3333-3333-333333333333'),
 ('Mariana Lopez','2015-01-29',true,'grey','33333333-3333-3333-3333-333333333333'),
 ('Andres Vargas','1991-09-19',false,'blue','33333333-3333-3333-3333-333333333333'),
 ('Juliana Prado','2000-12-12',false,'white','33333333-3333-3333-3333-333333333333');
