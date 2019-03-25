import { Component } from '@angular/core';
import { ViewController, AlertController, NavParams } from 'ionic-angular';
import { ImagePicker } from '@ionic-native/image-picker';
import { File } from '@ionic-native/file';

import { Category } from '../../models/category';
import { QuestionType } from '../../models/question';
import { Question } from '../../models/question';

@Component({
  selector: 'page-question',
  templateUrl: 'question.html'
})
export class QuestionPage {
  private maxPictures: number = 5;
  private QuestionType = QuestionType; //for use in Angluar html
  private title: string;
  private saveButtonName: string;
  private categorys: Array<Category>;
  private question: Question;
  private attachementDir: string;
  private previousType: QuestionType;
  private previousAnswers: Array<string>;
  private previousRightAnswer: number;

  constructor(public viewCtrl: ViewController,
              private alertCtrl: AlertController,
              private file: File,
              private imagePicker: ImagePicker,
              params: NavParams) {
    //avoid ionic warnings
    this.title = this.title;
    this.saveButtonName = this.saveButtonName;

    //lets make deep copies, so that we don't modfiy anything before user confirmation
    this.categorys = JSON.parse(JSON.stringify(params.data.categorys));

    if (!params.data.question) {
      this.question = {
        uuid: '',
        question: '',
        type: QuestionType.classic,
        rightAnswer: -1,
        answers: ['','','',''],
        extras: [],
        category: {name: this.categorys[0].name},
        authorId: -1
      };

      this.attachementDir = '';

      this.title = "New Question";
      this.saveButtonName = "Create";
    }
    else {
      this.question = JSON.parse(JSON.stringify(params.data.question));

      this.attachementDir = this.file.dataDirectory + params.data.quizUuid + '/' + this.question.uuid + '/';

      if (this.question.type == QuestionType.rightPicture) {
        for (let i: number = 0; i < this.question.answers.length; i++) {
          this.question.answers[i] = this.attachementDir + this.question.answers[i];
        }
      }

      this.title = "Edit Question";
      this.saveButtonName = "Save";
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

  categoryChange(val: string) {
    if (val === "new") {
      let alert = this.alertCtrl.create({
        title: 'New category',
        inputs: [
          {
            name: 'categoryName',
            placeholder: 'Economics'
          }
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: data => {
              this.question.category.name = this.categorys[0].name;
            }
          },
          {
            text: 'Create',
            handler: data => {
              if (data.categoryName.length > 3 && this.categorys.findIndex((category) => category.name === data.categoryName) === -1 ) {
                this.categorys.push({name: data.categoryName});
                this.question.category.name = data.categoryName;
              }
              else {
                this.question.category.name = this.categorys[0].name;

                let error = this.alertCtrl.create({
                  title: 'Error creating category',
                  message: 'Category name must be more than 3 characters long and should not already exist',
                  buttons: [
                    {
                      text: 'Ok',
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
  }

  replacePicture(val: number) {
    this.imagePicker.getPictures({maximumImagesCount: 1, width:1920, height: 1080}).then((results) => {
      for (var i = 0; i < results.length; i++) {
        this.question.answers[val] = results[i];
      }
    }).catch(() => {
      alert('Could not get images.');
    });
  }

  deletePicture(val: number) {
    if (this.question.rightAnswer === val) {
      this.question.rightAnswer = -1;
    }
    this.question.answers.splice(val, 1);
  }

  //https://stackoverflow.com/a/52970316
  openImagePicker() {
    this.imagePicker.getPictures({maximumImagesCount: this.maxPictures - this.question.answers.length, width:1920, height: 1080}).then((results) => {
      for (var i = 0; i < results.length; i++) {
        this.question.answers.push(decodeURIComponent(results[i]));
      }
    }).catch(() => {
      alert('Could not get images.');
    });
  }

  enableSaveButton() {
    let enable: boolean = true;
    if (this.question.question) {
      if (this.question.question.length > 0) {
        if (this.question.rightAnswer !== -1) {
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
    if (this.enableSaveButton()) {
      if (this.question.type == QuestionType.rightPicture) {
        for (let i: number = 0; i < this.question.answers.length; i++) {
          this.question.answers[i] = this.question.answers[i].replace(this.attachementDir, '');
        }
      }
      this.viewCtrl.dismiss({question: this.question});
    }
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }

}