import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform, kIsWeb;

class LocalFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        return linux;
      default:
        return web;
    }
  }

  static const _projectId = 'sti-locator-local';
  static const _apiKey = 'local-emulator-key';
  static const _databaseUrl =
      'https://sti-locator-local-default-rtdb.firebaseio.com';

  static const web = FirebaseOptions(
    apiKey: _apiKey,
    appId: '1:100000000000:web:1234567890abcdef123456',
    messagingSenderId: '100000000000',
    projectId: _projectId,
    authDomain: 'sti-locator-local.firebaseapp.com',
    databaseURL: _databaseUrl,
    storageBucket: 'sti-locator-local.appspot.com',
  );

  static const android = FirebaseOptions(
    apiKey: _apiKey,
    appId: '1:100000000000:android:1234567890abcdef123456',
    messagingSenderId: '100000000000',
    projectId: _projectId,
    databaseURL: _databaseUrl,
    storageBucket: 'sti-locator-local.appspot.com',
  );

  static const ios = FirebaseOptions(
    apiKey: _apiKey,
    appId: '1:100000000000:ios:1234567890abcdef123456',
    messagingSenderId: '100000000000',
    projectId: _projectId,
    databaseURL: _databaseUrl,
    storageBucket: 'sti-locator-local.appspot.com',
    iosBundleId: 'com.example.mobileApp',
  );

  static const macos = ios;
  static const windows = web;
  static const linux = web;
}
