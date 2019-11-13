import { Component, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Platform, NavController, MenuController, ModalController, ViewController, LoadingController, AlertController, Slides } from 'ionic-angular';
import { ImagePicker } from '@ionic-native/image-picker';
import { AndroidPermissions } from '@ionic-native/android-permissions';
import { TranslateService } from '@ngx-translate/core';

import { UserProfile } from '../../models/user-profile';

import { UserProfilesProvider } from '../../providers/user-profiles/user-profiles';
import { AuthenticationProvider } from '../../providers/authentication/authentication';

import { HomePage } from '../../pages/home/home';
import { SignUpPage } from '../../pages/sign-up/sign-up';

const MAX_PICTURE_WIDTH: number = 64;
const MAX_PICTURE_HEIGHT: number = 64;

@Component({
  selector: 'page-start',
  templateUrl: 'start.html'
})
export class StartPage {
  private profile: UserProfile;

  private email: string;
  private password: string;

  @ViewChild(Slides) slides: Slides;
  @ViewChild('fileInput') fileInput: ElementRef; //Picture selector for browser

  constructor(private platform: Platform,
    public navCtrl: NavController,
    public menuCtrl: MenuController,
    public modalCtrl: ModalController,
    public viewCtrl: ViewController,
    public loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private imagePicker: ImagePicker,
    private androidPermissions: AndroidPermissions,
    private sanitizer:DomSanitizer,
    private profilesProv: UserProfilesProvider,
    private authProv: AuthenticationProvider,
    public translate: TranslateService) {
    this.profile = {
      uuid: '',
      nickname: '',
      avatar : ''
    }

    this.email = '';
    this.password = '';
  }

  ngAfterViewInit() {
    //https://stackoverflow.com/a/45517166
    this.slides.onlyExternal = true;
  }

  goToStart() {
    this.slides.slideTo(0);
  }

  gotToLogin() {
    this.slides.slideTo(1);
  }

  gotToCreateProfile(profile?: UserProfile) {
    if (profile) {
      this.profile = {
        uuid: profile.uuid,
        nickname: profile.nickname,
        avatar: profile.avatar,
        email: profile.email
      }
    }

    this.slides.slideTo(2);
  }

  resetPassword() {
    let alert = this.alertCtrl.create({
      title: this.translate.instant('RESET_PASSWORD'),
      message: this.translate.instant('RESET_PASSWORD_INFO'),
      enableBackdropDismiss: false,
      inputs: [
        {
          name: 'email',
          placeholder: this.translate.instant('EMAIL'),
          type: 'email'
        }
      ],
      buttons: [
        {
          text: this.translate.instant('CANCEL'),
          role: 'cancel'
        },
        {
          text: this.translate.instant('OK'),
          handler: data => {
            let loading = this.loadingCtrl.create({
              content: this.translate.instant('RESETTING')
            });

            loading.present();

            this.authProv.resetPassword(data.email).then(() => {
              loading.dismiss();
              this.showOnlineAlert('RESET_PASSWORD', 'RESET_PASSWORD_CONFIRMATION');
            }).catch((error) => {
              loading.dismiss();
              this.showOnlineAlert('RESET_PASSWORD', error.code);
            });
          }
        }
      ]
    });

    alert.present();
  }

  startLogin() {
    let profile: UserProfile;
    let loading = this.loadingCtrl.create({
      content: this.translate.instant('LOGGING_IN')
    });

    loading.present();

    this.authProv.login(this.email, this.password).then((user) => {
      loading.dismiss();

      if (user.displayName) {
        profile = {
          uuid: '',
          nickname: user.displayName,
          avatar: user.photoURL,
          email: user.email
        }

        this.createProfile(profile);
      } else {
        profile = {
          uuid: '',
          nickname: '',
          avatar: '',
          email: user.email
        }

        this.gotToCreateProfile(profile);
      }
    }).catch((error) => {
      loading.dismiss();
      this.showOnlineAlert('ERROR_LOGGING_IN', error.code);
    });
  }

  showOnlineAlert(title: string, message: string) {
    let alertMsg = this.alertCtrl.create({
      title: this.translate.instant(title),
      message: this.translate.instant(message),
      enableBackdropDismiss: false,
      buttons: [
        {
          text: this.translate.instant('OK'),
          role: 'cancel',
        },
      ]
    });

    alertMsg.present();
  }

  enableLoginButton() {
    return this.email.length > 3 && this.password.length > 3;
  }

  openSignUpPage() {
    let modal = this.modalCtrl.create(SignUpPage);
    modal.present();

    modal.onDidDismiss(data => {
      if (data) {
        let profile: UserProfile;

        profile = {
          uuid: '',
          nickname: '',
          avatar: '',
          email: data.user.email
        }

        this.gotToCreateProfile(profile);
      }
    });
  }

  createProfile(profile?: UserProfile) {
    let loading = this.loadingCtrl.create({
      content: this.translate.instant('CREATING')
    });

    loading.present();

    this.profilesProv.saveToStorage((profile !== undefined ? profile : this.profile)).then((savedProfile) => {
      if (savedProfile.email) {
        this.authProv.updateUserProfile(savedProfile.nickname, savedProfile.avatar).then(() => {
          loading.dismiss();
          this.navCtrl.setRoot(HomePage);
          this.menuCtrl.enable(true, 'menu-one');
        }).catch((error) => {
          loading.dismiss();
          this.navCtrl.setRoot(HomePage);
          this.menuCtrl.enable(true, 'menu-one');
          alert('Unable to save User profile online. ' + error.code);
        });
      } else {
        loading.dismiss();
        this.navCtrl.setRoot(HomePage);
        this.menuCtrl.enable(true, 'menu-one');
      }
    }).catch(() => {
      loading.dismiss();
      alert('Unable to save User profile.');
    });
  }

  enableCreateButton() {
    let enable: boolean = false;
    if (this.profile.nickname) {
      if (this.profile.nickname.length > 2) {
        enable = true;
      }
    }
    return enable;
  }

  openImagePicker() {
    if (this.platform.is('android')) {
      this.androidPermissions.hasPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
      .then(status => {
        if (status.hasPermission) {
          this.openMobileImagePicker();
        } else {
          this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.WRITE_EXTERNAL_STORAGE)
          .then(status => {
            if(status.hasPermission) {
              this.openMobileImagePicker();
            }
          });
        }
      });
    } else {
      this.openBrowserImagePicker();
    }
  }

  openBrowserImagePicker(){
    this.fileInput.nativeElement.click();
  };

  getBrowserImage() {
    let file: any = this.fileInput.nativeElement.files[0];

    this.resizeBrowserImage(file).then((e: any) => {
      this.profile.avatar = e;
    }).catch(() => {
      alert('Could not resize image');
    });
  }

  openMobileImagePicker() {
    this.imagePicker.getPictures({maximumImagesCount: 1, width:MAX_PICTURE_WIDTH, height: MAX_PICTURE_HEIGHT, outputType: 1}).then((results) => {
      if (results.length === 1) {
        this.profile.avatar = 'data:image/png;base64,' + results[0];
      }
    }).catch(() => {
      alert('Could not get images.');
    });
  }

  renderPicture(base64: string) {
    return this.sanitizer.bypassSecurityTrustUrl(base64);
  }

  resizeBrowserImage(file: any) {
    return new Promise((resolve, reject) => {
      var reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e: any) => {
        //First resize the image
        //https://zocada.com/compress-resize-images-javascript-browser/
        let img = new Image();
        img.src = e.target.result;
        img.onload = (pic: any) => {
          let canvas = document.createElement('canvas');

          if (img.height > MAX_PICTURE_HEIGHT || img.width > MAX_PICTURE_WIDTH) {
            if ((img.height / MAX_PICTURE_HEIGHT) > (img.width / MAX_PICTURE_WIDTH)) {
              canvas.width = img.width / (img.height / MAX_PICTURE_HEIGHT)
              canvas.height = MAX_PICTURE_HEIGHT;
            } else {
              canvas.width = MAX_PICTURE_WIDTH
              canvas.height = img.height / (img.width / MAX_PICTURE_WIDTH) ;
            }
          } else {
            canvas.width = img.width;
            canvas.height = img.height;
          }

          let ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(ctx.canvas.toDataURL('image/jpeg', 0.8));
        };
      };
    });
  }
}
