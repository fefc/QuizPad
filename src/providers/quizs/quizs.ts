import * as firebase from "firebase/app";
import 'firebase/firestore';
import 'firebase/storage';

import { Injectable } from '@angular/core';
import { Observable } from "rxjs/Observable"
import { Subscription } from "rxjs/Subscription";

import { ConnectionProvider } from '../connection/connection';

import { Quiz } from '../../models/quiz';
import { QuizSettings } from '../../models/quiz-settings';

import { Question } from '../../models/question';
import { QuestionType } from '../../models/question';
import { Category } from '../../models/category';

interface FirebaseSnapshot {
  readonly uuid: string,
  readonly unsubscribe: () => void
}

interface FirebaseObservable {
  readonly uuid: string,
  readonly subscription: Subscription
}

/*
  Generated class for the QuizsProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class QuizsProvider {
  public quizs: Array<Quiz>;

  private profileUuid: string;
  private quizsChangesSubscription: Subscription;

  constructor(
    private connProv: ConnectionProvider) {
    this.quizs = new Array<Quiz>();
  }

  public sync(profileUuid: string) {
    return new Promise(async (resolve, reject) => {
      this.profileUuid = profileUuid;
      this.stopSync();

      try {
        //await this.loadFromOnline();
      } catch (error) {
        reject({message: error, code: 'sync/quizs-could-not-get-data'});
      }

      this.quizsChangesSubscription = this.quizsChanges().subscribe();
      resolve();
    });
  }

  public stopSync() {
    if (this.quizsChangesSubscription) this.quizsChangesSubscription.unsubscribe();
  }

  private quizsChanges() {
    return new Observable<boolean>(observer => {
      let snapshots: Array<FirebaseObservable> = new Array<FirebaseObservable>();

      const unsubscribe = firebase.firestore().collection('U').doc(this.profileUuid).collection('Q').onSnapshot((querySnapshot) => {
        let currentUuids: Array<string> = querySnapshot.docs.map((doc) => doc.id);
        let addedIndexes: Array<number> = querySnapshot.docChanges().filter((c) => c.type === 'added').map((c) => c.newIndex);

        for (let snapshot of snapshots) {
          if (!currentUuids.some(uuid => uuid === snapshot.uuid)) {
            snapshot.subscription.unsubscribe();
            snapshots.splice(snapshots.indexOf(snapshot), 1);
          }
        }

        this.quizs = this.quizs.filter((q) => currentUuids.some((uuid) => uuid === q.uuid));

        setTimeout(() => {
          for (let index of addedIndexes) {
            let quiz: Quiz = this.quizs.find((q) => q.uuid === querySnapshot.docs[index].id);

            if (!quiz) {
              quiz = {
                uuid: querySnapshot.docs[index].id,
                title: undefined,
                creationDate: undefined,
                settings: undefined,
                categorys: [],
                questions: [],
              };
            }

            snapshots.push({uuid: quiz.uuid, subscription: this.quizChanges(quiz).subscribe()});
          }
        }, 1000);
        //This timer is mandatory because firestore rules might have a small bug?
        //QuizChanges will fail is timer < 500 because of permissions

      }, (error) => {
        console.log('quizsChanges onSnapshot error: ', error);
      });

      return () => {
        for (let snapshot of snapshots) {
          snapshot.subscription.unsubscribe();
        }

        unsubscribe();
      };
    });
  }

  private quizChanges(quiz: Quiz) {
    return new Observable<boolean>(observer => {
      //First register for quiz data changes
      const unsubscribeQuizSnapshot = this.quizChangesOnSnapshot(quiz);

      //Then register for categorys changes
      const unsubscribeQuizcategorys = this.categorysChanges(quiz).subscribe();

      //Then register for questions changes
      const unsubscribeQuizQuestions = this.questionsChanges(quiz).subscribe();

      return () => {
        unsubscribeQuizQuestions.unsubscribe();
        unsubscribeQuizcategorys.unsubscribe();
        unsubscribeQuizSnapshot();

      };
    });
  }

  private quizChangesOnSnapshot(quiz: Quiz): () => void {
    return firebase.firestore().collection('Q').doc(quiz.uuid).onSnapshot((doc) => {
      if (doc.exists) {
        let data = doc.data();

        quiz.title = data.title;
        quiz.creationDate = 0;
        quiz.settings = data.settings;

        if (!this.quizs.some((q) => q.uuid === quiz.uuid)) {
          this.quizs.push(quiz);
        }
      }
    }, (error) => {
      console.log('quizChangesOnSnapshot error: ', error);
      console.log('this is failing');
    });
  }

  private questionsChanges(quiz: Quiz):  Observable<void> {
    return new Observable<void>(observer => {
      let snapshots: Array<FirebaseSnapshot> = new Array<FirebaseSnapshot>();

      const unsubscribe = firebase.firestore().collection('Q').doc(quiz.uuid).collection('Q').onSnapshot((querySnapshot) => {
        let currentUuids: Array<string> = querySnapshot.docs.map((doc) => doc.id);
        let addedIndexes: Array<number> = querySnapshot.docChanges().filter((c) => c.type === 'added').map((c) => c.newIndex);

        for (let snapshot of snapshots) {
          if (!currentUuids.some(uuid => uuid === snapshot.uuid)) {
            snapshot.unsubscribe();
            snapshots.splice(snapshots.indexOf(snapshot), 1);
          }
        }

        quiz.questions = quiz.questions.filter((q) => currentUuids.some((uuid) => uuid === q.uuid));

        for (let index of addedIndexes) {
          let question: Question = quiz.questions.find((q) => q.uuid === querySnapshot.docs[index].id);

          if (!question) {
            question = {
              uuid: querySnapshot.docs[index].id,
              afterQuestionUuid: undefined,
              question: undefined,
              type: undefined,
              rightAnswer: undefined,
              answers: undefined,
              extras: undefined,
              categoryUuid: undefined,
              authorId: undefined,
              hide: undefined,
              draft: undefined
            }
          }

          snapshots.push({uuid: question.uuid, unsubscribe: this.questionChangesOnSnapshot(quiz, question)});
        }
      }, (error) => {
        console.log('questionsChanges onSnapshot error: ', error);
      });

      return () => {
        for (let snapshot of snapshots) {
          snapshot.unsubscribe();
        }

        unsubscribe();
      };
    });
  }

  private questionChangesOnSnapshot(quiz: Quiz, question: Question): () => void {
    return firebase.firestore().collection('Q').doc(quiz.uuid).collection('Q').doc(question.uuid).onSnapshot(async (doc) => {
      if (doc.exists) {
        let data = doc.data();

        question.afterQuestionUuid = data.afterQuestionUuid,
        question.question = data.question,
        question.type = data.type,
        question.rightAnswer = data.rightAnswer,
        question.answers = data.answers,
        question.extras = data.extras,
        question.categoryUuid = data.categoryUuid,
        question.authorId = data.authorId,
        question.hide = data.hide,
        question.draft = data.draft

        if (!question.extrasUrl) question.extrasUrl = [];
        if (!question.answersUrl) question.answersUrl = [];

        if (!quiz.questions.some((q) => q.uuid === question.uuid)) {
          quiz.questions.push(question);
        }

        //Check attachements
        var checkPromises = [];
        var getAttachementPromises = [];
        const storageRef: string = 'Q/' + quiz.uuid + '/Q/' + question.uuid + '/';

        for (let i = 0; i < question.extras.length; i++) {
          checkPromises.push(this.connProv.checkPendingUpload(question.extras[i]));
        }

        if (question.type === QuestionType.rightPicture) {
          for (let i = 0; i < question.answers.length; i++) {
            checkPromises.push(this.connProv.checkPendingUpload(question.answers[i]));
          }
        }

        try {
          let pendingUploads = await Promise.all(checkPromises);

          if (pendingUploads.some((p) => p === true)) {
            await this.saveQuestionOnline(quiz, JSON.parse(JSON.stringify(question)));
          }
        } catch (error) {
          console.log(error);
        }

        for (let i = 0; i < question.extras.length; i++) {
          getAttachementPromises.push(this.connProv.getFileUrl(storageRef, question.extras[i]));
        }

        if (question.type === QuestionType.rightPicture) {
          for (let i = 0; i < question.answers.length; i++) {
            getAttachementPromises.push(this.connProv.getFileUrl(storageRef, question.answers[i]));
          }
        }

        Promise.all(getAttachementPromises).then((attachements) => {
          for (let i = 0; i < question.extras.length; i++) {
            question.extrasUrl[i] = attachements[i];
          }

          if (question.extras.length === 0) {
            question.extrasUrl = [];
          }

          if (question.type === QuestionType.rightPicture) {
            for (let i = 0; i < question.answers.length; i++) {
              question.answersUrl[i] = attachements[i + question.extras.length];
            }
          } else {
            question.answersUrl = [];
          }
        }).catch((error) => {
          console.log(error);
        });

        quiz.questions = this.orderQuestionsFromOnline(quiz.questions);
      } else {
        console.log('questionChangesOnSnapshot, quiz or question does not exists anymore.');
      }
    }, (error) => {
      console.log('questionChangesOnSnapshot error: ', error);
    });
  }

  private categorysChanges(quiz: Quiz):  Observable<void> {
    return new Observable<void>(observer => {
      let snapshots: Array<FirebaseSnapshot> = new Array<FirebaseSnapshot>();

      const unsubscribe = firebase.firestore().collection('Q').doc(quiz.uuid).collection('C').onSnapshot((querySnapshot) => {
        let currentUuids: Array<string> = querySnapshot.docs.map((doc) => doc.id);
        let addedIndexes: Array<number> = querySnapshot.docChanges().filter((c) => c.type === 'added').map((c) => c.newIndex);


        for (let snapshot of snapshots) {
          if (!currentUuids.some(uuid => uuid === snapshot.uuid)) {
            snapshot.unsubscribe();
            snapshots.splice(snapshots.indexOf(snapshot), 1);
          }
        }

        quiz.categorys = quiz.categorys.filter((c) => currentUuids.some((uuid) => uuid === c.uuid));

        for (let index of addedIndexes) {
          let category: Category = quiz.categorys.find((c) => c.uuid === querySnapshot.docs[index].id);

          if (!category) {
            category = {
              uuid: querySnapshot.docs[index].id,
              afterCategoryUuid: undefined,
              name: undefined
            }
          }

          snapshots.push({uuid: category.uuid, unsubscribe: this.categoryChangesOnSnapshot(quiz, category)});
        }
      }, (error) => {
        console.log('categorysChanges onSnapshot error: ', error);
      });

      return () => {
        for (let snapshot of snapshots) {
          snapshot.unsubscribe();
        }

        unsubscribe();
      };
    });
  }

  private categoryChangesOnSnapshot(quiz: Quiz, category: Category): () => void {
    return firebase.firestore().collection('Q').doc(quiz.uuid).collection('C').doc(category.uuid).onSnapshot((doc) => {
      if (doc.exists) {
        let data = doc.data();

        category.afterCategoryUuid = data.afterCategoryUuid,
        category.name = data.name

        if (!quiz.categorys.some((c) => c.uuid === category.uuid)) {
          quiz.categorys.push(category);
        }

        quiz.categorys = this.orderCategorysFromOnline(quiz.categorys);
      } else {
        console.log('categoryChangesOnSnapshot, quiz does not exists anymore');
      }
    }, (error) => {
      console.log('categoryChangesOnSnapshot error: ', error);
    });
  }

  public createQuizOnline(quiz: Quiz) {
    return new Promise((resolve, reject) => {
      let batch = firebase.firestore().batch();

      let newQuizRef = firebase.firestore().collection('Q').doc();

      batch.set(newQuizRef, {title: quiz.title, settings: quiz.settings});

      let quizUserRef = newQuizRef.collection('U').doc(this.profileUuid);
      batch.set(quizUserRef, {});

      let userQuizRef = firebase.firestore().collection('U').doc(this.profileUuid).collection('Q').doc(newQuizRef.id);
      batch.set(userQuizRef, {});

      for (let i = 0; i < quiz.categorys.length ; i++) {
        let quizCategoryRef = newQuizRef.collection('C').doc();

        quiz.categorys[i] = {
          uuid: quizCategoryRef.id,
          afterCategoryUuid: i > 0 ? quiz.categorys[i - 1].afterCategoryUuid : 'first',
          name: quiz.categorys[i].name
        };

        batch.set(quizCategoryRef, {name: quiz.categorys[i].name});
      }

      batch.commit();

      setTimeout(() => {
        resolve(newQuizRef.id);
      }, 2000); //This timer is mandatory because of quizChanges timer
    });
  }

  public deleteQuizsOnline() {
    return new Promise((resolve, reject) => {
      let batch = firebase.firestore().batch();

      for (let selectedQuiz of this.quizs.filter((quiz) => quiz.selected === true)) {
        let quizUserRef = firebase.firestore().collection('Q').doc(selectedQuiz.uuid).collection('U').doc(this.profileUuid);
        batch.delete(quizUserRef);

        let userQuizRef = firebase.firestore().collection('U').doc(this.profileUuid).collection('Q').doc(selectedQuiz.uuid);
        batch.delete(userQuizRef);
      }

      batch.commit();
      resolve();
    });
  }

  public saveSettingsOnline(quiz: Quiz, title: string, settings: QuizSettings) {
    return new Promise((resolve, reject) => {
      let changes = this.getSettingsPropertiesChanges(quiz, title, settings);

      if (changes) {
        firebase.firestore().collection('Q').doc(quiz.uuid).update(changes);
        resolve();
      } else {
        resolve();
      }
    });
  }

  public saveCategorysOnline(quiz: Quiz, categorys: Array<Category>) {
    return new Promise((resolve, reject) => {
      let batch = firebase.firestore().batch();

      for (let category of categorys) {
        let changes = this.getCategoryPropertiesChanges(quiz, category);

        if (changes) {
          let categoryRef = firebase.firestore().collection('Q').doc(quiz.uuid).collection('C').doc(category.uuid);
          batch.update(categoryRef, changes);
        }
      }

      // Commit the batch
      batch.commit();
      resolve();
    });
  }

  public deleteCategoryOnline(quiz: Quiz, category: Category) {
    return new Promise<string>((resolve, reject) => {
      let batch = firebase.firestore().batch();

      for (let question of quiz.questions.filter((q) => q.categoryUuid === category.uuid)) {
        let questionRef = firebase.firestore().collection('Q').doc(quiz.uuid).collection('Q').doc(question.uuid);
        batch.delete(questionRef);
      }

      let categoryRef = firebase.firestore().collection('Q').doc(quiz.uuid).collection('C').doc(category.uuid);
      batch.delete(categoryRef);

      // Commit the batch
      batch.commit();
      resolve();
    });
  }

  public saveQuestionOnline(quiz: Quiz, question: Question, newCategory?: Category, skipUpload?: boolean) {
    return new Promise(async (resolve, reject) => {
      //Make sure to have a reference (id) before handling attachements
      let questionRef;

      if (question.uuid) {
        questionRef = firebase.firestore().collection('Q').doc(quiz.uuid).collection('Q').doc(question.uuid);
      }
      else {
        questionRef = firebase.firestore().collection('Q').doc(quiz.uuid).collection('Q').doc();
      }

      if (!skipUpload) {
        try {
          let uploadPromises = []
          const storageRef: string = 'Q/' + quiz.uuid + '/Q/' + questionRef.id + '/';

          for (let i = 0; i < question.extras.length; i++) {
            uploadPromises.push(this.connProv.uploadFile(storageRef, question.extras[i], this.profileUuid));
          }

          if (question.type === QuestionType.rightPicture) {
            for (let i = 0; i < question.answers.length; i++) {
              uploadPromises.push(this.connProv.uploadFile(storageRef, question.answers[i], this.profileUuid));
            }
          }

          let attachementResults: Array<string> = await Promise.all(uploadPromises.map(p => p.catch(e => undefined)));

          for (let i = 0; i < question.extras.length; i++) {
            if (attachementResults[i]) question.extras[i] = attachementResults[i];
          }

          if (question.type === QuestionType.rightPicture) {
            for (let i = 0; i < question.answers.length; i++) {
              if (attachementResults[i + question.extras.length]) question.answers[i] = attachementResults[i + question.extras.length];
            }
          }
        } catch (error) {
          console.log(error);
        }
      }

      let batch = firebase.firestore().batch();

      if (newCategory) {
        let newCatRef = firebase.firestore().collection('Q').doc(quiz.uuid).collection('C').doc();
        batch.set(newCatRef, {afterCategoryUuid: newCategory.afterCategoryUuid, name: newCategory.name});

        newCategory = {
          uuid: newCatRef.id,
          afterCategoryUuid: newCategory.afterCategoryUuid,
          name: newCategory.name
        };

        question.categoryUuid = newCategory.uuid;
      }

      //Do the normal stuff
      let changes = this.getQuestionPropertiesChanges(quiz, question);

      if (changes) {
        if (question.uuid) {
          batch.update(questionRef, changes);
        }
        else {
          batch.set(questionRef, changes);
        }

        // Commit the batch
        batch.commit();
        resolve();
      } else {
        resolve();
      }
    });
  }

  public deleteQuestionsOnline(quiz: Quiz) {
    return new Promise<string>((resolve, reject) => {
      let batch = firebase.firestore().batch();

      for (let question of quiz.questions.filter((q) => q.selected === true)) {
        let questionRef = firebase.firestore().collection('Q').doc(quiz.uuid).collection('Q').doc(question.uuid);
        batch.delete(questionRef);
      }

      // Commit the batch
      batch.commit();
      resolve();
    });
  }

  public saveQuestionsOnline(quiz: Quiz, questions: Array<Question>) {
    return new Promise((resolve, reject) => {
      let batch = firebase.firestore().batch();

      for (let question of questions) {
        let changes = this.getQuestionPropertiesChanges(quiz, question);

        if (changes) {
          let questionRef;

          if (question.uuid) {
            questionRef = firebase.firestore().collection('Q').doc(quiz.uuid).collection('Q').doc(question.uuid);
            batch.update(questionRef, changes);
          }
          else {
            reject('cant batch update new questions');
          }
        }
      }

      // Commit the batch
      batch.commit();
      resolve();
    });
  }

  orderQuestionsFromOnline(toBeSortedQuestions: Array<Question>) {
    let searchedUuid: string = 'first';

    let sortedQuestions: Array<Question> = new Array<Question>();

    while (toBeSortedQuestions.length > 0) {
      let currentIndex: number = toBeSortedQuestions.findIndex((q) => q.afterQuestionUuid === searchedUuid);
      if (currentIndex === -1) currentIndex = 0; //Fail safe operation, if something is wrong with ids, just push the next

      searchedUuid = toBeSortedQuestions[currentIndex].uuid;
      sortedQuestions.push(toBeSortedQuestions[currentIndex]);

      toBeSortedQuestions.splice(currentIndex, 1);
    }

    return sortedQuestions;
  }

  orderCategorysFromOnline(toBeSortedCategorys: Array<Category>) {
    let searchedUuid: string = 'first';

    let sortedCategorys: Array<Category> = new Array<Category>();

    while (toBeSortedCategorys.length > 0) {
      let currentIndex = toBeSortedCategorys.findIndex((q) => q.afterCategoryUuid === searchedUuid);
      if (currentIndex === -1) currentIndex = 0; //Fail safe operation, if something is wrong with ids, just push the next

      searchedUuid = toBeSortedCategorys[currentIndex].uuid;
      sortedCategorys.push(toBeSortedCategorys[currentIndex]);

      toBeSortedCategorys.splice(currentIndex, 1);
    }

    return sortedCategorys;
  }

  private getSettingsPropertiesChanges(quiz: Quiz, title: string, settings: QuizSettings) {
    let savedSettings: QuizSettings = quiz.settings;
    let changes: any = {};

    if (savedSettings && quiz.uuid) {
      //title is considered as part of settings, simplifies firebase updates
      if (title !== quiz.title) changes['title'] = title;

      //An update on settings
      if (settings.commonAnimationDuration !== undefined && settings.commonAnimationDuration !== savedSettings.commonAnimationDuration) changes['settings.commonAnimationDuration'] = settings.commonAnimationDuration;
      if (settings.timeBarAnimationDuration !== undefined && settings.timeBarAnimationDuration !== savedSettings.timeBarAnimationDuration) changes['settings.timeBarAnimationDuration'] = settings.timeBarAnimationDuration;
      if (settings.playerAnswerAnimationDuration !== undefined && settings.playerAnswerAnimationDuration !== savedSettings.playerAnswerAnimationDuration) changes['settings.playerAnswerAnimationDuration'] = settings.playerAnswerAnimationDuration;
      if (settings.showNextDelay !== undefined && settings.showNextDelay !== savedSettings.showNextDelay) changes['settings.showNextDelay'] = settings.showNextDelay;
      if (settings.amountOfPicturesToShow !== undefined && settings.amountOfPicturesToShow !== savedSettings.amountOfPicturesToShow) changes['settings.amountOfPicturesToShow'] = settings.amountOfPicturesToShow;
      if (settings.autoPlay !== undefined && settings.autoPlay !== savedSettings.autoPlay) changes['settings.autoPlay'] = settings.autoPlay;
      if (settings.startMessage !== undefined && settings.startMessage !== savedSettings.startMessage) changes['settings.startMessage'] = settings.startMessage;
      if (settings.endMessage !== undefined && settings.endMessage !== savedSettings.endMessage) changes['settings.endMessage'] = settings.endMessage;
      if (settings.backgroundImage !== undefined && settings.backgroundImage !== savedSettings.backgroundImage) changes['settings.backgroundImage'] = settings.backgroundImage;
      if (settings.extraDisplayDuration !== undefined && settings.extraDisplayDuration !== savedSettings.extraDisplayDuration) changes['settings.extraDisplayDuration'] = settings.extraDisplayDuration;

    } else {
      //title is considered as part of settings, simplifies firebase updates
      changes['title'] = title;

      //A creation of a quiz and so settings as well
      if (settings.commonAnimationDuration !== undefined) changes['settings.commonAnimationDuration'] = settings.commonAnimationDuration;
      if (settings.timeBarAnimationDuration !== undefined) changes['settings.timeBarAnimationDuration'] = settings.timeBarAnimationDuration;
      if (settings.playerAnswerAnimationDuration !== undefined) changes['settings.playerAnswerAnimationDuration'] = settings.playerAnswerAnimationDuration;
      if (settings.showNextDelay !== undefined) changes['settings.showNextDelay'] = settings.showNextDelay;
      if (settings.amountOfPicturesToShow !== undefined) changes['settings.amountOfPicturesToShow'] = settings.amountOfPicturesToShow;
      if (settings.autoPlay !== undefined) changes['settings.autoPlay'] = settings.autoPlay;
      if (settings.startMessage !== undefined) changes['settings.startMessage'] = settings.startMessage;
      if (settings.endMessage !== undefined) changes['settings.endMessage'] = settings.endMessage;
      if (settings.backgroundImage !== undefined) changes['settings.backgroundImage'] = settings.backgroundImage;
      if (settings.extraDisplayDuration !== undefined) changes['settings.extraDisplayDuration'] = settings.extraDisplayDuration;
    }

    if (Object.keys(changes).length === 0) return undefined;
    else return changes;
  }

  private getCategoryPropertiesChanges(quiz: Quiz, category: Category) {
    let savedCategory: Category = quiz.categorys.find((c) => c.uuid === category.uuid);
    let changes: any = {};

    if (savedCategory) {
      //An update on a category
      if (category.afterCategoryUuid !== savedCategory.afterCategoryUuid) changes.afterCategoryUuid = category.afterCategoryUuid;
      if (category.name !== savedCategory.name) changes.name = category.name;
    } else {
      //A creation of a category
      changes.afterCategoryUuid = category.afterCategoryUuid;
      changes.name = category.name;
    }

    if (Object.keys(changes).length === 0) return undefined;
    else return changes;
  }

  private getQuestionPropertiesChanges(quiz: Quiz, question: Question) {
    let savedQuestion: Question = quiz.questions.find((q) => q.uuid === question.uuid);
    let changes: any = {};

    if (savedQuestion) {
      //An update on a question
      if (question.afterQuestionUuid !== savedQuestion.afterQuestionUuid) changes.afterQuestionUuid = question.afterQuestionUuid;
      if (question.question !== savedQuestion.question) changes.question = question.question;
      if (question.type !== savedQuestion.type) changes.type = question.type;
      if (question.categoryUuid !== savedQuestion.categoryUuid) changes.categoryUuid = question.categoryUuid;
      if (question.rightAnswer !== savedQuestion.rightAnswer) changes.rightAnswer = question.rightAnswer;
      if (question.draft !== savedQuestion.draft) changes.draft = question.draft;
      if (question.hide !== savedQuestion.hide) changes.hide = question.hide;
      if (JSON.stringify(question.answers) !== JSON.stringify(savedQuestion.answers)) changes.answers = question.answers;
      if (JSON.stringify(question.extras) !== JSON.stringify(savedQuestion.extras)) changes.extras = question.extras;
    } else {
      //A creation of a question
      changes.afterQuestionUuid = question.afterQuestionUuid;
      changes.question = question.question;
      changes.type = question.type;
      changes.categoryUuid = question.categoryUuid;
      changes.rightAnswer = question.rightAnswer;
      changes.draft = question.draft;
      changes.hide = question.hide;
      changes.answers = question.answers;
      changes.extras = question.extras;
    }

    if (Object.keys(changes).length === 0) return undefined;
    else return changes;
  }
}
