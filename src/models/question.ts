import { Category } from './category';

export enum QuestionType {
  classic = 1,
  stopwatch = 2,
  rightPicture = 3
}

export interface Question {
  readonly uuid: string,
  question: string,
  type: QuestionType,
  rightAnswer: number,
  answers: Array<string>,
  extras: Array<string>,
  category: Category;
  authorId: number,
  selected?: boolean
}
