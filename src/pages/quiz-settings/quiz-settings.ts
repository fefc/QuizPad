import { Component } from '@angular/core';
import { ViewController, ToastController, NavParams } from 'ionic-angular';

import { Quiz } from '../../models/quiz';
import { QuizSettings } from '../../models/quiz-settings';
import { DefaultQuizSettings } from '../../models/quiz-settings';

@Component({
  selector: 'page-quiz-settings',
  templateUrl: 'quiz-settings.html'
})
export class QuizSettingsPage {
  private settings: QuizSettings;
  private showAdvancedCounter: number;

  constructor(public viewCtrl: ViewController,
              public toastCtrl: ToastController,
              params: NavParams) {
    this.showAdvancedCounter = 0;

    if (params.data.settings) {
      //lets make deep copies, so that we don't modfiy anything before user confirmation
      this.settings = JSON.parse(JSON.stringify(params.data.settings));
    } else {
      this.settings = {};
    }

    if (this.settings.commonAnimationDuration === undefined) {
      this.settings.commonAnimationDuration = DefaultQuizSettings.COMMON_ANIMATION_DURATION;
    }

    if (this.settings.timeBarAnimationDuration === undefined) {
      this.settings.timeBarAnimationDuration = DefaultQuizSettings.TIMEBAR_ANIMATION_DURATION;
    }

    if (this.settings.playerAnswerAnimationDuration === undefined) {
      this.settings.playerAnswerAnimationDuration = DefaultQuizSettings.PLAYER_ANSWER_ANIMATION_DURATION;
    }

    if (this.settings.showNextDelay === undefined) {
      this.settings.showNextDelay = DefaultQuizSettings.SHOW_NEXT_DELAY;
    }

    if (this.settings.amountOfPicturesToShow === undefined) {
      this.settings.amountOfPicturesToShow = DefaultQuizSettings.AMOUNT_OF_PICUTRES_TO_SHOW;
    }

    if (this.settings.autoPlay === undefined) {
      this.settings.autoPlay = DefaultQuizSettings.AUTO_PLAY;
    }
  }

  enableSaveButton() {
    let enable: boolean = true;
    if (this.settings.commonAnimationDuration < 1 || this.settings.commonAnimationDuration > DefaultQuizSettings.COMMON_ANIMATION_DURATION * 4) {
      enable = false;
    }

    if (this.settings.timeBarAnimationDuration < 1 || this.settings.timeBarAnimationDuration > DefaultQuizSettings.TIMEBAR_ANIMATION_DURATION * 4) {
      enable = false;
    }

    if (this.settings.playerAnswerAnimationDuration < 1 || this.settings.playerAnswerAnimationDuration > DefaultQuizSettings.PLAYER_ANSWER_ANIMATION_DURATION * 4) {
      enable = false;
    }

    if (this.settings.showNextDelay < 1 || this.settings.showNextDelay > DefaultQuizSettings.SHOW_NEXT_DELAY * 4) {
      enable = false;
    }

    if (this.settings.amountOfPicturesToShow < 1 || this.settings.amountOfPicturesToShow > DefaultQuizSettings.AMOUNT_OF_PICUTRES_TO_SHOW * 4) {
      enable = false;
    }

    return enable;
  }

  save() {
    if (this.enableSaveButton()) {
      let newSettings: QuizSettings = {};

      if (this.settings.commonAnimationDuration !== DefaultQuizSettings.COMMON_ANIMATION_DURATION) {
        newSettings.commonAnimationDuration = this.settings.commonAnimationDuration;
      }

      if (this.settings.timeBarAnimationDuration !== DefaultQuizSettings.TIMEBAR_ANIMATION_DURATION) {
        newSettings.timeBarAnimationDuration = this.settings.timeBarAnimationDuration;
      }

      if (this.settings.playerAnswerAnimationDuration !== DefaultQuizSettings.PLAYER_ANSWER_ANIMATION_DURATION) {
        newSettings.playerAnswerAnimationDuration = this.settings.playerAnswerAnimationDuration;
      }

      if (this.settings.showNextDelay !== DefaultQuizSettings.SHOW_NEXT_DELAY) {
        newSettings.showNextDelay = this.settings.showNextDelay;
      }

      if (this.settings.amountOfPicturesToShow !== DefaultQuizSettings.AMOUNT_OF_PICUTRES_TO_SHOW) {
        newSettings.amountOfPicturesToShow = this.settings.amountOfPicturesToShow;
      }

      if (this.settings.autoPlay !== DefaultQuizSettings.AUTO_PLAY) {
        newSettings.autoPlay = this.settings.autoPlay;
      }

      this.viewCtrl.dismiss({settings: newSettings});
    }
  }

  setDefaultValues() {
      this.settings.commonAnimationDuration = DefaultQuizSettings.COMMON_ANIMATION_DURATION;
      this.settings.timeBarAnimationDuration = DefaultQuizSettings.TIMEBAR_ANIMATION_DURATION;
      this.settings.playerAnswerAnimationDuration = DefaultQuizSettings.PLAYER_ANSWER_ANIMATION_DURATION;
      this.settings.showNextDelay = DefaultQuizSettings.SHOW_NEXT_DELAY;
      this.settings.amountOfPicturesToShow = DefaultQuizSettings.AMOUNT_OF_PICUTRES_TO_SHOW;
      this.settings.autoPlay = DefaultQuizSettings.AUTO_PLAY;
  }

  showAdvanced() {
    if (this.showAdvancedCounter < 2) {
      let toast = this.toastCtrl.create({
        message: 'Click ' + (2 - this.showAdvancedCounter) + ' more times to show advanced settings',
        duration: 2000
      });
      toast.present();
    }

    this.showAdvancedCounter += 1;
  }

  dismiss() {
    this.viewCtrl.dismiss();
  }

}