export function under15StripeClasses(student:{belt:string;birth_date:string|null},today=new Date()):number|null {
 if(!student.birth_date || (student.belt!=="white" && student.belt!=="grey")) return null;
 const birth=new Date(`${student.birth_date}T00:00:00`);
 const birthday=new Date(birth.getFullYear()+15,birth.getMonth(),birth.getDate());
 return today<birthday?15:null;
}