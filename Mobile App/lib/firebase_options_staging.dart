// Firebase configuration for the fac-loc-stg project.
// ignore_for_file: type=lint
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class StagingFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => android,
      TargetPlatform.iOS => ios,
      _ => throw UnsupportedError(
        'Staging Firebase is configured for Android, iOS, and web only.',
      ),
    };
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDKOSgYGC0WpQ5Co1klezJOQ_pDee0t4JQ',
    appId: '1:401195980724:web:a126bd95728e065dec84e1',
    messagingSenderId: '401195980724',
    projectId: 'fac-loc-stg',
    authDomain: 'fac-loc-stg.firebaseapp.com',
    databaseURL: 'https://fac-loc-stg-default-rtdb.firebaseio.com',
    storageBucket: 'fac-loc-stg.firebasestorage.app',
    measurementId: 'G-PT4N2H81K1',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBVKHWLMBKCVDm0Gitxm2Tl2Htyfd_mJBo',
    appId: '1:401195980724:android:6cb87bd748733921ec84e1',
    messagingSenderId: '401195980724',
    projectId: 'fac-loc-stg',
    databaseURL: 'https://fac-loc-stg-default-rtdb.firebaseio.com',
    storageBucket: 'fac-loc-stg.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBRINXoXwJQQj3mEhzknFT3-8ymVbZXzRI',
    appId: '1:401195980724:ios:0d9664eda70f0e88ec84e1',
    messagingSenderId: '401195980724',
    projectId: 'fac-loc-stg',
    databaseURL: 'https://fac-loc-stg-default-rtdb.firebaseio.com',
    storageBucket: 'fac-loc-stg.firebasestorage.app',
    iosBundleId: 'com.example.mobileApp',
  );
}
