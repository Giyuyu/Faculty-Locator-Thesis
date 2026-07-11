# Firebase Realtime Database Setup

This app is wired to read faculty data from Firebase Realtime Database path:

```text
users/facultys
```

Current data shape from the Firebase export:

```json
{
  "users": {
    "facultys": {
      "NVS0690F": {
        "current_room": "Room 101",
        "current_subject": "No current class",
        "email": "karencristy.cifra@novaliches.sti.edu.ph",
        "facultyId": "NVS0690F",
        "is_logged_in": true,
        "name": "Karen Cifra",
        "uid": "8II88TTf6FdlI1Q4XHsSKhzNlFl1",
        "userType": "faculty"
      }
    }
  }
}
```

The app derives faculty locator status this way:

```text
Available: is_logged_in is false, current_subject is "Logged out", or current_subject is "No current class"
In class: is_logged_in is true and current_subject contains an active subject
```

## FlutterFire setup

The Flutter project and Firebase packages already exist, so you can skip
`flutter create` and package installation.

If the Firebase CLI token has expired, run this first in your own terminal:

```powershell
firebase login --reauth
```

Then generate the platform config for the existing Firebase project:

```powershell
dart pub global activate flutterfire_cli
flutterfire configure --project=fac-loc --platforms=android,ios,web --android-package-name=com.example.mobile_app --ios-bundle-id=com.example.mobileApp --out=lib/firebase_options.dart --yes --overwrite-firebase-options
```

This should create:

```text
android/app/google-services.json
ios/Runner/GoogleService-Info.plist
lib/firebase_options.dart
```

After `firebase_options.dart` is generated, update `lib/main.dart` to initialize with:

```dart
import 'firebase_options.dart';

await Firebase.initializeApp(
  options: DefaultFirebaseOptions.currentPlatform,
);
```

Until Firebase config is present, the app safely falls back to local sample data.
