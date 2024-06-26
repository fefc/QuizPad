import { Component, ViewChild } from '@angular/core';
import { Platform, ViewController, ModalController, AlertController, ToastController, NavParams, Slides, FabContainer, reorderArray } from 'ionic-angular';
import { ImagePicker } from '@ionic-native/image-picker';
import { AndroidPermissions } from '@ionic-native/android-permissions';
import { TranslateService } from '@ngx-translate/core';

import { Category } from '../../models/category';
import { QuestionType } from '../../models/question';
import { Question } from '../../models/question';

import { ConnectionProvider } from '../../providers/connection/connection';

import { QuestionExtraPage } from '../question-extra/question-extra';

const MAX_PICTURE_WIDTH: number = 1920;
const MAX_PICTURE_HEIGHT: number = 1080;
const MAX_FILE_SIZE: number = 2000000; //OCTETS

@Component({
  selector: 'page-question',
  templateUrl: 'question.html'
})

export class QuestionPage {
  private readonly MAX_PICTURES = 5; //for use in Angluar html
  private QuestionType = QuestionType; //for use in Angluar html
  private categorys: Array<Category>;
  private question: Question;
  private previousType: QuestionType;
  private previousAnswers: Array<string>;
  private previousRightAnswer: number;

  private newQuestion: boolean;

  private storageRef: string;

  @ViewChild(Slides) slides: Slides;
  @ViewChild('slidesFab') slidesFab : FabContainer;

  constructor(private platform: Platform,
              public viewCtrl: ViewController,
              public modalCtrl: ModalController,
              private alertCtrl: AlertController,
              private toastCtrl: ToastController,
              private imagePicker: ImagePicker,
              private androidPermissions: AndroidPermissions,
              private connProv: ConnectionProvider,
              private translate: TranslateService,
              params: NavParams) {

    this.newQuestion = true;
    this.storageRef = '';

    //To avoid warings on ionic build
    this.newQuestion = this.newQuestion;

    //lets make deep copies, so that we don't modfiy anything before user confirmation
    this.categorys = JSON.parse(JSON.stringify(params.data.categorys));

    if (!params.data.question) {
      this.question = {
        uuid: '',
        afterQuestionUuid: '',
        question: '',
        type: QuestionType.classic,
        rightAnswer: -1,
        draft: true,
        hide: false,
        answers: ['','','',''],
        extras: [],
        categoryUuid: this.categorys[0].uuid,
        authorId: -1,
        answersUrl: [],
        extrasUrl: []
      };
    }
    else {
      this.question = JSON.parse(JSON.stringify(params.data.question));
      this.newQuestion = false;
      this.storageRef = 'Q/' + params.data.quizUuid + '/Q/' + this.question.uuid + '/';

      if (this.question.type === QuestionType.rightPicture) {
        for (let i = 0; i < this.question.answers.length; i++) {
          if (typeof this.question.answersUrl[i] !== 'string') {
            this.question.answersUrl[i] = undefined;
            setTimeout(async () =>  {
              this.question.answersUrl[i] = await this.connProv.getFileUrl(this.storageRef, this.question.answers[i]);
            }, 0); //Constructor can't get aysnc so let's do it my way.
          }
        }
      }

      //
    }

    if (this.question.type === QuestionType.rightPicture) {
      this.previousType = QuestionType.rightPicture;
      this.previousAnswers = ['', '', '', ''];
    }
    else {
      this.previousType = QuestionType.classic;
      this.previousAnswers = [];
    }

    this.previousRightAnswer = -1;
  }

  indexTracker(index: number, obj: any) {
    return index;
  }

  reorderAnswers(indexes:any) {
    if (this.question.rightAnswer !== -1) {
      let rightAnswer = this.question.answers[this.question.rightAnswer];

      this.question.answers = reorderArray(this.question.answers, indexes);
      this.question.rightAnswer = this.question.answers.indexOf(rightAnswer);
    } else {
      this.question.answers = reorderArray(this.question.answers, indexes);
    }
  }

  questionMaxLengthReached(maxLength) {
    if (this.question.question.length >= maxLength) {
      let toast = this.toastCtrl.create({
        message: this.translate.instant('QUESTION_TOO_LONG'),
        duration: 6000,
        showCloseButton: true,
        closeButtonText: this.translate.instant('OK'),
        position: 'bottom'
      });

      toast.present();
    }
  }

  answerMaxLengthReached(maxLength, answerIndex) {
    if (this.question.answers[answerIndex].length >= maxLength) {
      let toast = this.toastCtrl.create({
        message: this.translate.instant('ANSWER_TOO_LONG'),
        duration: 6000,
        showCloseButton: true,
        closeButtonText: this.translate.instant('OK'),
        position: 'bottom'
      });

      toast.present();
    }
  }

  categoryChange(val: string) {
    if (val === "newVal") {
      let alert = this.alertCtrl.create({
        title: this.translate.instant('NEW_CATEGORY'),
        inputs: [
          {
            name: 'categoryName',
            placeholder: this.translate.instant('RENAME_CATEGORY_PLACEHOLDER')
          }
        ],
        buttons: [
          {
            text: this.translate.instant('CANCEL'),
            role: 'cancel',
            handler: data => {
              this.question.categoryUuid = this.categorys[0].uuid;
            }
          },
          {
            text: this.translate.instant('CREATE'),
            handler: data => {
              if (data.categoryName.length > 3 && this.categorys.findIndex((category) => category.name === data.categoryName) === -1 ) {

                let indexOfNew: number = this.categorys.findIndex((category) => category.uuid === 'new');

                if (indexOfNew === -1){
                  this.categorys.push({uuid: 'new', afterCategoryUuid: this.categorys[this.categorys.length - 1].uuid, name: data.categoryName});
                } else {
                  this.categorys[indexOfNew].afterCategoryUuid = this.categorys[this.categorys.length - 1].uuid;
                  this.categorys[indexOfNew].name = data.categoryName;
                }

                this.question.categoryUuid = 'new';
              }
              else {
                this.question.categoryUuid = this.categorys[0].uuid;

                let error = this.alertCtrl.create({
                  title: this.translate.instant('ERROR_CREATING_CATEGORY'),
                  message: this.translate.instant('ERROR_CREATING_CATEGORY_INFO'),
                  buttons: [
                    {
                      text: this.translate.instant('OK'),
                      role: 'ok',
                    }
                  ]
                });
                error.present();
              }
            }
          }
        ]
      });
      alert.present();
    }
  }

  typeChange(val: QuestionType) {
    if (val !== this.previousType) {
      if (val === QuestionType.rightPicture || this.previousType === QuestionType.rightPicture) {
        let futurePreviousAnswers: Array<string> = JSON.parse(JSON.stringify(this.question.answers));
        let futurePreviousRightAnswer: number = this.question.rightAnswer;

        this.question.answers = JSON.parse(JSON.stringify(this.previousAnswers));
        this.question.rightAnswer = this.previousRightAnswer;

        this.previousAnswers = futurePreviousAnswers;
        this.previousRightAnswer = futurePreviousRightAnswer;
      }
      this.previousType = val;
    }
  }

  rightPicture(val: number) {
    this.question.rightAnswer = val;
    this.slidesFab.close();
  }

  openImagePicker(maximumImagesCount: number) {
    if (this.platform.is('android')) {
      this.androidPermissions.hasPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
      .then(status => {
        if (status.hasPermission) {
          this.openMobileImagePicker(maximumImagesCount);
        } else {
          this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
          .then(status => {
            if(status.hasPermission) {
              this.openMobileImagePicker(maximumImagesCount);
            }
          });
        }
      });
    } else {
      this.openMobileImagePicker(maximumImagesCount);
    }

    this.slidesFab.close();
  }

  replacePicture(val: number) {
    if (this.platform.is('android')) {
      this.androidPermissions.hasPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
      .then(status => {
        if (status.hasPermission) {
          this.replacePictureMobile(val);
        } else {
          this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
          .then(status => {
            if(status.hasPermission) {
              this.replacePictureMobile(val);
            }
          });
        }
      });
    } else {
      this.replacePictureMobile(val);
    }

    this.slidesFab.close();
  }

  //https://stackoverflow.com/a/52970316
  openMobileImagePicker(maximumImagesCount: number) {
    let maxImages: number = maximumImagesCount - this.question.answers.length;

    this.imagePicker.getPictures({maximumImagesCount: maxImages, width: MAX_PICTURE_WIDTH, height: MAX_PICTURE_HEIGHT, quality: 90}).then(async (results) => {
      for (var i = 0; i < results.length; i++) {
        let decodedURI = decodeURIComponent(results[i]);

        if (await this.connProv.isFileSizeValid(decodedURI, MAX_FILE_SIZE)) {
          this.question.answers.push(decodedURI);
          try {
          this.question.answersUrl.push(await this.connProv.getLocalFileUrl(decodedURI));
          } catch (error) {
            console.log(error);
            this.question.answers.pop();
          }
        } else {
          this.showFileToBigAlert();
        }
      }
    }).catch(() => {
      alert('Could not get images.');
    });
  }

  replacePictureMobile(val: number) {
    this.imagePicker.getPictures({maximumImagesCount: 1, width:MAX_PICTURE_WIDTH, height: MAX_PICTURE_HEIGHT, quality: 90}).then(async (results) => {
      if (results.length > 0) {
        let decodedURI = decodeURIComponent(results[0]);

        if (await this.connProv.isFileSizeValid(decodedURI, MAX_FILE_SIZE)) {
          this.question.answers[val] = decodedURI;
          try {
          this.question.answersUrl[val] = await this.connProv.getLocalFileUrl(decodedURI);
          } catch (error) {
            console.log(error);
            this.question.answers.splice(val, 1);
          }
        } else {
          this.showFileToBigAlert();
        }
      }
    }).catch(() => {
      alert('Could not get images.');
    });
  }

  deletePicture(val: number) {
    if (this.question.rightAnswer === val) {
      this.question.rightAnswer = -1;
    } else if (this.question.rightAnswer > val) {
      this.question.rightAnswer -= 1;
    }

    this.question.answers.splice(val, 1);
    this.question.answersUrl.splice(val, 1);

    val = val - 1;

    if (val >= 0 && val < this.question.answers.length) {
      this.slides.slideTo(val);
    }

    this.slides.update();
    this.slidesFab.close();
  }

  openQuestionExtraPage() {
    let modal = this.modalCtrl.create(QuestionExtraPage, {storageRef: this.storageRef, title: this.question.question, extras: this.question.extras, extrasUrl: this.question.extrasUrl}, {cssClass: 'modal-fullscreen'});
    modal.present();
    modal.onDidDismiss(data => {
      if (data) {
        this.question.extras = data.extras;
      }
    });
  }

  enableDraftButton() {
    let enable: boolean = false;
    if (this.question.question) {
      if (this.question.question.length > 0) {
        enable = true;
      }
    }

    return enable;
  }

  enableSaveButton() {
    let enable: boolean = true;
    if (this.question.question) {
      if (this.question.question.length > 0) {
        if (this.question.rightAnswer !== -1 && this.question.rightAnswer !== undefined) {
          for (let answer of this.question.answers) {
            if (answer.length === 0) {
              enable = false;
            }
          }
        }
        else {
          enable = false;
        }
      }
      else {
        enable = false;
      }
    }
    else {
      enable = false;
    }
    return enable;
  }

  save() {
    let newCategory: Category = undefined;

    if (this.question.categoryUuid === 'new') {
      newCategory = this.categorys.find((category) => category.uuid === 'new');
    }

    if (this.enableSaveButton()) {
      this.question.draft = false;
      this.viewCtrl.dismiss({question: this.question, newCategory: newCategory});
    } else if (this.enableDraftButton()) {
      this.question.draft = true;
      this.viewCtrl.dismiss({question: this.question, newCategory: newCategory});
    }
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }

  showFileToBigAlert() {
    let error = this.alertCtrl.create({
      title: this.translate.instant('ERROR_FILE_TOO_BIG'),
      message: this.translate.instant('ERROR_FILE_TOO_BIG_INFO') + ' ' + (MAX_FILE_SIZE / 1000000) + 'MB.',
      buttons: [
        {
          text: this.translate.instant('OK'),
          role: 'ok',
        }
      ]
    });
    error.present();
  }
}
