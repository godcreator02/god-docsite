import peopleFile from '../../people.json';

export interface Person {
  id: string;
  name: string;
  codes?: string[];
  agent?: boolean;
}

export const people = peopleFile as Person[];

export function personById(id: string): Person | undefined {
  return people.find((person) => person.id === id);
}

export function personByCode(code: string): Person | undefined {
  return people.find((person) => person.codes?.includes(code));
}
