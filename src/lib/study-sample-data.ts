export type SampleSubSubject = {
  name: string;
};

export type SampleSubject = {
  name: string;
  subs: SampleSubSubject[];
};

/** The board starts empty — every subject is created by the user. */
export const SAMPLE_SUBJECTS: SampleSubject[] = [];
