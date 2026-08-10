import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'firebase_options.dart';
import 'firebase_options_local.dart';
import 'firebase_options_staging.dart';

const stiLogoAsset = 'resources/sti_logo-DgEAj6lq.png';
const appEnvironment = String.fromEnvironment(
  'APP_ENV',
  defaultValue: 'production',
);
const isStaging = appEnvironment == 'staging';
const isLocal = appEnvironment == 'local';
const localFirebaseHostOverride = String.fromEnvironment(
  'LOCAL_FIREBASE_HOST',
  defaultValue: '',
);

late final FirebaseApp locatorFirebaseApp;
FirebaseAuth get locatorAuth =>
    FirebaseAuth.instanceFor(app: locatorFirebaseApp);
FirebaseDatabase get locatorDatabase =>
    FirebaseDatabase.instanceFor(app: locatorFirebaseApp);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final firebaseOptions = isLocal
      ? LocalFirebaseOptions.currentPlatform
      : isStaging
      ? StagingFirebaseOptions.currentPlatform
      : DefaultFirebaseOptions.currentPlatform;
  locatorFirebaseApp = await Firebase.initializeApp(
    name: isLocal
        ? 'sti-locator-local'
        : isStaging
        ? 'sti-locator-staging'
        : null,
    options: firebaseOptions,
  );
  if (isLocal) {
    final emulatorHost = localFirebaseHostOverride.isNotEmpty
        ? localFirebaseHostOverride
        : (!kIsWeb && defaultTargetPlatform == TargetPlatform.android)
        ? '10.0.2.2'
        : '127.0.0.1';
    await locatorAuth.useAuthEmulator(emulatorHost, 9099);
    locatorDatabase.useDatabaseEmulator(emulatorHost, 9000);
  }
  runApp(const StiLocatorMobileApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const StiLocatorMobileApp();
  }
}

class Palette {
  static const blue = Color(0xFF1764FF);
  static const blueDark = Color(0xFF0B3BA7);
  static const navy = Color(0xFF14213D);
  static const yellow = Color(0xFFFFE500);
  static const bg = Color(0xFFF2F6FF);
  static const surface = Color(0xFFFFFFFF);
  static const text = Color(0xFF111827);
  static const muted = Color(0xFF60708C);
  static const border = Color(0xFFD8E2F0);
  static const success = Color(0xFF059669);
  static const warning = Color(0xFFF59E0B);
  static const danger = Color(0xFFEF4444);
  static const purple = Color(0xFF7C3AED);
}

class StiLocatorMobileApp extends StatelessWidget {
  const StiLocatorMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'STI Locator',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: Palette.bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Palette.blue,
          primary: Palette.blue,
          surface: Palette.surface,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Palette.text,
          elevation: 0,
          surfaceTintColor: Colors.white,
          centerTitle: false,
          toolbarHeight: 68,
          shape: Border(bottom: BorderSide(color: Palette.border)),
        ),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: Colors.white,
          indicatorColor: const Color(0xFFE8F0FF),
          height: 72,
          labelTextStyle: WidgetStateProperty.resolveWith(
            (states) => TextStyle(
              color: states.contains(WidgetState.selected)
                  ? Palette.blue
                  : Palette.muted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          iconTheme: WidgetStateProperty.resolveWith(
            (states) => IconThemeData(
              color: states.contains(WidgetState.selected)
                  ? Palette.blue
                  : Palette.muted,
            ),
          ),
        ),
        cardTheme: const CardThemeData(
          color: Colors.white,
          surfaceTintColor: Colors.white,
          margin: EdgeInsets.zero,
        ),
        textTheme: const TextTheme(
          headlineSmall: TextStyle(
            color: Palette.text,
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
          titleLarge: TextStyle(
            color: Palette.text,
            fontSize: 20,
            fontWeight: FontWeight.w900,
          ),
          bodyMedium: TextStyle(color: Palette.text, height: 1.4),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 15,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Palette.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Palette.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Palette.blue, width: 1.5),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: Palette.blue,
            foregroundColor: Colors.white,
            minimumSize: const Size(44, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(44, 44),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
        ),
      ),
      home: const LoginScreen(),
    );
  }
}

class AppUser {
  const AppUser({
    required this.uid,
    required this.name,
    required this.username,
    required this.roleIds,
    required this.permissions,
    required this.userType,
    this.facultyId,
  });

  final String uid;
  final String name;
  final String username;
  final List<String> roleIds;
  final Map<String, bool> permissions;
  final String userType;
  final String? facultyId;

  bool get isAdmin => userType == 'admin' || roleIds.contains('admin');
  bool get isFaculty =>
      userType.toLowerCase() == 'faculty' ||
      roleIds.any((role) => role.toLowerCase() == 'faculty');
  bool get isStudent =>
      userType.toLowerCase() == 'student' ||
      roleIds.any((role) => role.toLowerCase() == 'student');
  bool get canAccessFaculty =>
      isFaculty || permissions['access_faculty_module'] == true;
  bool get canAccessStudent =>
      isStudent || permissions['access_student_module'] == true;
  bool get hasMultipleMobileModules => canAccessFaculty && canAccessStudent;
  String get mobileRole =>
      userType.toLowerCase() == 'student' ? 'student' : 'faculty';
  bool has(String permission) => isAdmin || permissions[permission] == true;

  AppUser forMobileModule(String module) => AppUser(
    uid: uid,
    name: name,
    username: username,
    roleIds: roleIds,
    permissions: permissions,
    userType: module,
    facultyId: facultyId,
  );
}

class AppData {
  const AppData({
    required this.raw,
    required this.facultyLocations,
    required this.roomLocations,
    required this.schedules,
    required this.lastScheduleUpdate,
  });

  final Map<String, dynamic> raw;
  final List<FacultyLocation> facultyLocations;
  final List<RoomLocation> roomLocations;
  final List<ScheduleEntry> schedules;
  final Map<String, dynamic>? lastScheduleUpdate;

  factory AppData.from(dynamic value) {
    final raw = asMap(value);
    final faculties = asMap(raw['faculties']);
    final rooms = asMap(raw['rooms']);
    final subjects = asMap(raw['subjects']);
    final schedulesRaw = asMap(raw['schedules']);
    final scheduleUploads = asMap(raw['schedule_uploads']);
    final statuses = asMap(raw['faculty_status']);
    final sessions = asMap(raw['faculty_login_sessions']);

    final activeUploads =
        scheduleUploads.values
            .whereType<Map>()
            .map(asStringMap)
            .where(
              (upload) =>
                  str(upload['status']).isEmpty ||
                  str(upload['status']) == 'active',
            )
            .toList()
          ..sort((a, b) {
            final aDate =
                DateTime.tryParse(
                  firstText(a, ['uploaded_at', 'imported_at', 'activated_at']),
                ) ??
                DateTime.fromMillisecondsSinceEpoch(0);
            final bDate =
                DateTime.tryParse(
                  firstText(b, ['uploaded_at', 'imported_at', 'activated_at']),
                ) ??
                DateTime.fromMillisecondsSinceEpoch(0);
            return bDate.compareTo(aDate);
          });
    final activeUploadId = activeUploads.isEmpty
        ? ''
        : firstText(activeUploads.first, [
            'schedule_upload_id',
            'import_batch_id',
          ]);

    final schedules =
        schedulesRaw.values
            .whereType<Map>()
            .map(asStringMap)
            .where((schedule) {
              final status = str(schedule['status']);
              if (status.isNotEmpty && status != 'active') return false;
              if (activeUploadId.isEmpty) return true;
              final uploadId = firstText(schedule, [
                'import_batch_id',
                'original_import_batch_id',
              ]);
              return uploadId == activeUploadId;
            })
            .map(
              (item) => ScheduleEntry.fromMap(item, subjects, rooms, faculties),
            )
            .toList()
          ..sort(
            (a, b) =>
                '${a.day}${a.startTime}'.compareTo('${b.day}${b.startTime}'),
          );

    final statusByFaculty = <String, Map<String, dynamic>>{};
    for (final status in statuses.values) {
      final map = asStringMap(status);
      final facultyId = str(map['faculty_id']);
      if (facultyId.isNotEmpty) statusByFaculty[facultyId] = map;
    }

    final sessionByFaculty = <String, Map<String, dynamic>>{};
    for (final session in sessions.values) {
      final map = asStringMap(session);
      if (str(map['session_status']) == 'Logged-Out') continue;
      final facultyId = str(map['faculty_id']);
      if (facultyId.isEmpty) continue;
      final existing = sessionByFaculty[facultyId];
      if (existing == null ||
          DateTime.tryParse(str(map['login_time']))?.isAfter(
                DateTime.tryParse(str(existing['login_time'])) ??
                    DateTime.fromMillisecondsSinceEpoch(0),
              ) ==
              true) {
        sessionByFaculty[facultyId] = map;
      }
    }

    final facultyIds = <String>{
      ...faculties.values
          .map((f) => str(asStringMap(f)['faculty_id']))
          .where((id) => id.isNotEmpty),
      ...statusByFaculty.keys,
      ...sessionByFaculty.keys,
    };

    final facultyLocations = facultyIds.map((facultyId) {
      final faculty = findById(faculties, facultyId, 'faculty_id');
      final status = statusByFaculty[facultyId];
      final activeSession = sessionByFaculty[facultyId];
      final liveSchedule = activeSession == null
          ? null
          : currentScheduleFor(schedules, facultyId);
      final storedScheduleId = str(status?['schedule_id']).isNotEmpty
          ? str(status?['schedule_id'])
          : str(activeSession?['schedule_id']);
      final storedSchedule = schedules
          .where((s) => s.scheduleId == storedScheduleId)
          .firstOrNull;
      final schedule = liveSchedule ?? storedSchedule;
      final roomId = str(status?['current_room_id']).isNotEmpty
          ? str(status?['current_room_id'])
          : str(activeSession?['room_id']);
      final room = findById(rooms, roomId, 'room_id');
      final subjectId =
          schedule?.subjectId ?? str(status?['current_subject_id']);
      final subject = findById(subjects, subjectId, 'subject_id');
      final hasClass =
          activeSession != null && schedule != null && subjectId.isNotEmpty;
      final currentStatus = activeSession == null
          ? 'Offline'
          : (hasClass ? 'In-Class' : 'Available');

      return FacultyLocation(
        id: facultyId,
        name: displayName(faculty, fallback: facultyId),
        department: str(faculty['department']).isEmpty
            ? 'Not Available'
            : str(faculty['department']),
        status: currentStatus,
        room: str(room['room_name']).isNotEmpty
            ? str(room['room_name'])
            : roomId,
        subject: hasClass
            ? (str(subject['subject_name']).isNotEmpty
                  ? str(subject['subject_name'])
                  : subjectId)
            : (currentStatus == 'Available'
                  ? 'In room, no active class'
                  : 'Offline'),
        hasClass: hasClass,
        startTime: schedule?.startTime ?? '',
        endTime: schedule?.endTime ?? '',
        loginTime: str(status?['last_login_time']).isNotEmpty
            ? str(status?['last_login_time'])
            : str(activeSession?['login_time']),
      );
    }).toList()..sort((a, b) => a.name.compareTo(b.name));

    final roomLocations = rooms.values.whereType<Map>().map((item) {
      final room = asStringMap(item);
      final roomId = str(room['room_id']);
      final occupants = facultyLocations
          .where(
            (faculty) =>
                faculty.room == str(room['room_name']) ||
                faculty.room == roomId,
          )
          .toList();
      return RoomLocation(
        id: roomId,
        room: str(room['room_name']).isNotEmpty
            ? str(room['room_name'])
            : roomId,
        building: str(room['building']),
        floor: str(room['floor']).isEmpty
            ? floorFromRoom(str(room['room_name']))
            : str(room['floor']),
        status: occupants.isNotEmpty
            ? 'Occupied'
            : (str(room['room_status']).isEmpty
                  ? 'Available'
                  : str(room['room_status'])),
        occupants: occupants,
      );
    }).toList()..sort((a, b) => a.room.compareTo(b.room));

    return AppData(
      raw: raw,
      facultyLocations: facultyLocations,
      roomLocations: roomLocations,
      schedules: schedules,
      lastScheduleUpdate: raw['lastScheduleUpdate'] is Map
          ? asStringMap(raw['lastScheduleUpdate'])
          : null,
    );
  }
}

Map<String, dynamic>? notificationForUser(AppData? data, AppUser user) {
  if (data == null) return null;
  final audience = user.mobileRole;
  final notifications = asMap(data.raw['notifications']);
  final audienceNotifications = asMap(notifications[audience]);
  final notification = asStringMap(audienceNotifications['latest']);
  if (notification.isEmpty || str(notification['audience']) != audience) {
    return null;
  }
  return notification;
}

List<Map<String, dynamic>> notificationsForUser(AppData? data, AppUser user) {
  if (data == null) return const [];
  final audience = user.mobileRole;
  final notifications = asMap(data.raw['notifications']);
  final audienceNotifications = asMap(notifications[audience]);
  final items = asMap(audienceNotifications['items']);
  final results = items.values
      .whereType<Map>()
      .map(asStringMap)
      .where((item) => str(item['audience']) == audience)
      .toList();
  final latest = asStringMap(audienceNotifications['latest']);
  if (latest.isNotEmpty &&
      str(latest['audience']) == audience &&
      !results.any(
        (item) =>
            notificationKey(item, audience) ==
            notificationKey(latest, audience),
      )) {
    results.add(latest);
  }
  results.sort((a, b) {
    final aTime = DateTime.tryParse(str(a['time'])) ?? DateTime(1970);
    final bTime = DateTime.tryParse(str(b['time'])) ?? DateTime(1970);
    return bTime.compareTo(aTime);
  });
  return results;
}

String notificationKey(Map<String, dynamic> notification, String audience) {
  final eventId = str(notification['event_id']);
  if (eventId.isNotEmpty) return '$audience|$eventId';
  return '$audience|${str(notification['time'])}|${str(notification['title'])}';
}

String notificationTimeLabel(dynamic value) {
  final raw = str(value);
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) return raw.isEmpty ? 'No timestamp' : raw;
  final local = parsed.toLocal();
  final hour = local.hour == 0
      ? 12
      : (local.hour > 12 ? local.hour - 12 : local.hour);
  final minute = local.minute.toString().padLeft(2, '0');
  final period = local.hour >= 12 ? 'PM' : 'AM';
  return '${local.month}/${local.day}/${local.year} $hour:$minute $period';
}

class FacultyLocation {
  const FacultyLocation({
    required this.id,
    required this.name,
    required this.department,
    required this.status,
    required this.room,
    required this.subject,
    required this.hasClass,
    required this.startTime,
    required this.endTime,
    required this.loginTime,
  });

  final String id;
  final String name;
  final String department;
  final String status;
  final String room;
  final String subject;
  final bool hasClass;
  final String startTime;
  final String endTime;
  final String loginTime;

  String get statusLabel => status == 'In-Class'
      ? 'In Class'
      : status == 'Available'
      ? 'In Room'
      : 'Offline';
}

class RoomLocation {
  const RoomLocation({
    required this.id,
    required this.room,
    required this.building,
    required this.floor,
    required this.status,
    required this.occupants,
  });

  final String id;
  final String room;
  final String building;
  final String floor;
  final String status;
  final List<FacultyLocation> occupants;
}

class ScheduleEntry {
  const ScheduleEntry({
    required this.scheduleId,
    required this.facultyId,
    required this.facultyName,
    required this.subjectId,
    required this.subject,
    required this.room,
    required this.day,
    required this.startTime,
    required this.endTime,
    required this.section,
    required this.term,
    required this.schoolYear,
  });

  final String scheduleId;
  final String facultyId;
  final String facultyName;
  final String subjectId;
  final String subject;
  final String room;
  final String day;
  final String startTime;
  final String endTime;
  final String section;
  final String term;
  final String schoolYear;

  factory ScheduleEntry.fromMap(
    Map<String, dynamic> schedule,
    Map<String, dynamic> subjects,
    Map<String, dynamic> rooms,
    Map<String, dynamic> faculties,
  ) {
    final subject = findById(
      subjects,
      str(schedule['subject_id']),
      'subject_id',
    );
    final room = findById(rooms, str(schedule['room_id']), 'room_id');
    final faculty = findById(
      faculties,
      str(schedule['faculty_id']),
      'faculty_id',
    );
    final uploadedFacultyName = firstText(schedule, [
      'faculty_name',
      'instructor_name',
      'teacher_name',
      'faculty',
      'instructor',
      'teacher',
      'name',
    ]);
    return ScheduleEntry(
      scheduleId: str(schedule['schedule_id']),
      facultyId: str(schedule['faculty_id']),
      facultyName: displayName(faculty, fallback: uploadedFacultyName),
      subjectId: str(schedule['subject_id']),
      subject: str(subject['subject_name']).isNotEmpty
          ? str(subject['subject_name'])
          : str(schedule['subject_name']).isNotEmpty
          ? str(schedule['subject_name'])
          : str(schedule['subject_id']),
      room: str(room['room_name']).isNotEmpty
          ? str(room['room_name'])
          : str(schedule['room_name']).isNotEmpty
          ? str(schedule['room_name'])
          : str(schedule['room_id']),
      day: str(schedule['day']).isEmpty ? 'TBD' : str(schedule['day']),
      startTime: str(schedule['start_time']).isEmpty
          ? 'TBD'
          : str(schedule['start_time']),
      endTime: str(schedule['end_time']).isEmpty
          ? 'TBD'
          : str(schedule['end_time']),
      section: str(schedule['section']).isEmpty
          ? 'TBD'
          : str(schedule['section']),
      term: str(schedule['term']).isNotEmpty
          ? str(schedule['term'])
          : str(schedule['semester']),
      schoolYear: str(schedule['school_year']),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final email = _email.text.trim();
    final password = _password.text;
    final validationMessage = loginValidationMessage(email, password);
    if (validationMessage != null) {
      _snack(validationMessage);
      return;
    }

    setState(() => _loading = true);
    try {
      final snapshot = await locatorDatabase.ref().get();
      final data = AppData.from(snapshot.value);
      final user = await authenticateMobileUser(email, password, data.raw);
      if (!mounted) return;
      if (user == null) {
        _snack('Invalid account or inactive user.');
        return;
      }
      if (!user.isFaculty && !user.isStudent) {
        await locatorAuth.signOut();
        _snack('The mobile app is available to faculty and students only.');
        return;
      }
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => MobileShell(user: user)),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F6FB),
      body: SafeArea(
        top: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            return _LoginResponsiveLayout(
              viewport: constraints.biggest,
              card: _LoginCard(
                email: _email,
                password: _password,
                obscure: _obscure,
                loading: _loading,
                onTogglePassword: () => setState(() => _obscure = !_obscure),
                onLogin: _login,
                onForgotPassword: () => _snack(
                  'Contact your school administrator to reset your password.',
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  void _snack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _LoginResponsiveLayout extends StatelessWidget {
  const _LoginResponsiveLayout({required this.viewport, required this.card});

  final Size viewport;
  final Widget card;

  @override
  Widget build(BuildContext context) {
    if (viewport.width >= 1000) return _desktop();
    return _stacked(tablet: viewport.width >= 600);
  }

  Widget _desktop() {
    return Stack(
      children: [
        const Positioned.fill(child: _LoginBackdrop()),
        Positioned.fill(
          child: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1440),
                child: Row(
                  children: [
                    const Expanded(flex: 11, child: _LoginHero(expanded: true)),
                    Expanded(
                      flex: 9,
                      child: SingleChildScrollView(
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 52,
                          vertical: 38,
                        ),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minHeight: viewport.height - 76,
                          ),
                          child: Center(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 520),
                              child: _LoginEntrance(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    card,
                                    const SizedBox(height: 22),
                                    const _LoginFooter(),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _stacked({required bool tablet}) {
    final maxWidth = tablet ? 680.0 : 480.0;
    final heroHeight = tablet ? 280.0 : 238.0;
    final horizontalPadding = tablet ? 52.0 : 22.0;
    final minimumHeight = tablet ? 820.0 : 760.0;

    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: SizedBox(
            height: viewport.height < minimumHeight
                ? minimumHeight
                : viewport.height,
            child: Stack(
              children: [
                const Positioned.fill(child: _LoginBackdrop()),
                Positioned.fill(
                  child: _LoginEntrance(
                    child: Column(
                      children: [
                        _LoginHero(height: heroHeight, tablet: tablet),
                        Transform.translate(
                          offset: const Offset(0, -24),
                          child: Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: horizontalPadding,
                            ),
                            child: card,
                          ),
                        ),
                        Transform.translate(
                          offset: const Offset(0, -8),
                          child: const _LoginFooter(),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginEntrance extends StatelessWidget {
  const _LoginEntrance({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
      tween: Tween(begin: 0, end: 1),
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - value)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

class _LoginFooter extends StatelessWidget {
  const _LoginFooter();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 28),
      child: Text(
        'Secure access for STI students and faculty',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Color(0xFF71809C),
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _LoginBackdrop extends StatelessWidget {
  const _LoginBackdrop();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFFF3F7FE),
      child: CustomPaint(painter: _LoginBackdropPainter()),
    );
  }
}

class _LoginHero extends StatelessWidget {
  const _LoginHero({this.expanded = false, this.tablet = false, this.height});

  final bool expanded;
  final bool tablet;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: expanded ? double.infinity : height ?? 238,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          expanded ? 72 : 24,
          expanded ? 48 : 34,
          expanded ? 50 : 24,
          expanded ? 48 : 44,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: expanded
              ? CrossAxisAlignment.start
              : CrossAxisAlignment.center,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                stiLogoAsset,
                key: const ValueKey('sti-login-logo'),
                width: expanded
                    ? 126
                    : tablet
                    ? 104
                    : 88,
                height: expanded
                    ? 76
                    : tablet
                    ? 64
                    : 54,
                fit: BoxFit.contain,
                semanticLabel: 'STI logo',
              ),
            ),
            SizedBox(height: expanded ? 30 : 18),
            RichText(
              key: const ValueKey('sti-locator-title'),
              textAlign: expanded ? TextAlign.left : TextAlign.center,
              text: TextSpan(
                style: TextStyle(
                  color: Palette.text,
                  fontSize: expanded ? 42 : 28,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0,
                ),
                children: const [
                  TextSpan(text: 'STI '),
                  TextSpan(
                    text: 'Locator',
                    style: TextStyle(color: Palette.blue),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Text(
              expanded
                  ? 'A simple way to find faculty, check rooms, and view schedules across campus.'
                  : 'Campus access, simplified.',
              textAlign: expanded ? TextAlign.left : TextAlign.center,
              style: TextStyle(
                color: const Color(0xFF526581),
                fontSize: expanded ? 17 : 14,
                height: 1.55,
                fontWeight: FontWeight.w500,
              ),
            ),
            if (expanded) ...[
              const SizedBox(height: 38),
              const _LoginFeatures(),
            ],
          ],
        ),
      ),
    );
  }
}

class _LoginFeatures extends StatelessWidget {
  const _LoginFeatures();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(26, 22, 26, 20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .92),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFDCE6F3)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12112A4D),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.shield_outlined, color: Palette.blue, size: 21),
              SizedBox(width: 10),
              Text(
                'Campus tools',
                style: TextStyle(
                  color: Palette.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          SizedBox(height: 17),
          _LoginFeatureRow(
            icon: Icons.people_alt_outlined,
            color: Palette.blue,
            text: 'Faculty location and availability',
          ),
          SizedBox(height: 12),
          _LoginFeatureRow(
            icon: Icons.calendar_month_outlined,
            color: Color(0xFF0F9F8F),
            text: 'Personal class schedules',
          ),
          SizedBox(height: 12),
          _LoginFeatureRow(
            icon: Icons.meeting_room_outlined,
            color: Color(0xFF7C3AED),
            text: 'Current room status',
          ),
        ],
      ),
    );
  }
}

class _LoginFeatureRow extends StatelessWidget {
  const _LoginFeatureRow({
    required this.icon,
    required this.color,
    required this.text,
  });

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(7),
          ),
          child: Icon(icon, color: Colors.white, size: 17),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(color: Color(0xFF526581), fontSize: 14),
          ),
        ),
      ],
    );
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({
    required this.email,
    required this.password,
    required this.obscure,
    required this.loading,
    required this.onTogglePassword,
    required this.onLogin,
    required this.onForgotPassword,
  });

  final TextEditingController email;
  final TextEditingController password;
  final bool obscure;
  final bool loading;
  final VoidCallback onTogglePassword;
  final VoidCallback onLogin;
  final VoidCallback onForgotPassword;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFDCE4F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1A153968),
            blurRadius: 26,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Welcome Back',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Palette.blue,
              fontSize: 27,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 7),
          const Text(
            'Sign in to continue to your dashboard',
            textAlign: TextAlign.center,
            style: TextStyle(color: Palette.muted, fontSize: 14),
          ),
          const SizedBox(height: 22),
          const Text(
            'School email',
            style: TextStyle(
              color: Palette.text,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 7),
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            textInputAction: TextInputAction.next,
            decoration: _fieldDecoration(
              hint: 'Enter your email',
              icon: Icons.alternate_email_rounded,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Password',
                  style: TextStyle(
                    color: Palette.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              TextButton(
                onPressed: onForgotPassword,
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  minimumSize: const Size(0, 32),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  foregroundColor: Palette.blue,
                ),
                child: const Text(
                  'Forgot password?',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          TextField(
            controller: password,
            obscureText: obscure,
            autofillHints: const [AutofillHints.password],
            decoration: _fieldDecoration(
              hint: 'Enter your password',
              icon: Icons.lock_outline_rounded,
              suffix: IconButton(
                tooltip: obscure ? 'Show password' : 'Hide password',
                onPressed: onTogglePassword,
                icon: Icon(
                  obscure
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: Palette.muted,
                  size: 20,
                ),
              ),
            ),
            onSubmitted: (_) => onLogin(),
          ),
          const SizedBox(height: 22),
          FilledButton.icon(
            onPressed: loading ? null : onLogin,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
              backgroundColor: Palette.blue,
              disabledBackgroundColor: const Color(0xFF9BB9F7),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              elevation: 0,
            ),
            icon: loading
                ? const SizedBox.square(
                    dimension: 19,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.login_rounded, size: 20),
            label: Text(
              loading ? 'Signing in...' : 'Sign In',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 16),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.shield_outlined, size: 15, color: Color(0xFF0F9F8F)),
              SizedBox(width: 6),
              Flexible(
                child: Text(
                  'Protected school account access',
                  style: TextStyle(
                    color: Palette.muted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static InputDecoration _fieldDecoration({
    required String hint,
    required IconData icon,
    Widget? suffix,
  }) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, size: 20),
      suffixIcon: suffix,
      fillColor: const Color(0xFFF8FAFD),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    );
  }
}

class _LoginBackdropPainter extends CustomPainter {
  const _LoginBackdropPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final rightPanel = Paint()..color = const Color(0xFFE9F9FC);
    canvas.drawRect(
      Rect.fromLTWH(size.width * .62, 0, size.width * .38, size.height),
      rightPanel,
    );

    final outline = Paint()
      ..color = const Color(0xFF8DBEFF).withValues(alpha: .2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final softBlue = Paint()..color = const Color(0xFFDDEEFF);
    final softMint = Paint()..color = const Color(0xFFC6F5EA);
    final softYellow = Paint()..color = const Color(0xFFFFEDAA);

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * .06, size.height * .08, 48, 48),
        const Radius.circular(7),
      ),
      softBlue,
    );
    canvas.drawCircle(
      Offset(size.width * .12, size.height * .24),
      11,
      Paint()..color = const Color(0xFFFFDCE3),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * .31, size.height * .72, 64, 64),
        const Radius.circular(8),
      ),
      outline,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * .67, size.height * .09, 28, 28),
        const Radius.circular(6),
      ),
      Paint()..color = const Color(0xFFEEDCFF),
    );

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * .88, size.height * .17, 70, 70),
        const Radius.circular(8),
      ),
      outline,
    );
    canvas.drawCircle(
      Offset(size.width * .91, size.height * .23),
      35,
      softBlue,
    );
    canvas.drawCircle(
      Offset(size.width * .95, size.height * .14),
      19,
      softYellow,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * .925, size.height * .28, 52, 52),
        const Radius.circular(7),
      ),
      softMint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * .04, size.height * .7, 86, 86),
        const Radius.circular(8),
      ),
      outline,
    );
    canvas.drawCircle(
      Offset(size.width * .84, size.height * .75),
      14,
      softYellow,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(size.width * .89, size.height * .72, 72, 72),
        const Radius.circular(8),
      ),
      outline,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class MobileShell extends StatefulWidget {
  const MobileShell({super.key, required this.user});

  final AppUser user;

  @override
  State<MobileShell> createState() => _MobileShellState();
}

String initialMobileModule(AppUser user) {
  final preferred = user.userType.toLowerCase();
  if (preferred == 'student' && user.canAccessStudent) return 'student';
  if (preferred == 'faculty' && user.canAccessFaculty) return 'faculty';
  return user.canAccessFaculty ? 'faculty' : 'student';
}

class _MobileShellState extends State<MobileShell> {
  AppData? _data;
  StreamSubscription<DatabaseEvent>? _subscription;
  late AppUser _user;
  int _tabIndex = 0;
  late String _activeModule;
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    _user = widget.user;
    _activeModule = initialMobileModule(_user);
    _subscription = locatorDatabase.ref().onValue.listen((event) {
      if (!mounted || _leaving) return;
      final data = AppData.from(event.snapshot.value);
      final refreshedUser = refreshMobileUser(data.raw, _user);
      if (refreshedUser == null ||
          (!refreshedUser.isFaculty && !refreshedUser.isStudent)) {
        _leaving = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) returnToLogin(context);
        });
        return;
      }
      setState(() {
        _data = data;
        _user = refreshedUser;
        if (_activeModule == 'faculty' && !_user.canAccessFaculty) {
          _activeModule = 'student';
          _tabIndex = 0;
        } else if (_activeModule == 'student' && !_user.canAccessStudent) {
          _activeModule = 'faculty';
        }
      });
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    final isFacultyModule = _activeModule == 'faculty';
    final moduleUser = _user.forMobileModule(_activeModule);
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: const _LogoHeader(compact: true),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(26),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
              child: Text(
                '${isFacultyModule ? 'FACULTY' : 'STUDENT'} MODULE',
                style: const TextStyle(
                  color: Palette.blue,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
        actions: [
          if (_user.hasMultipleMobileModules)
            IconButton(
              tooltip: 'Switch module',
              onPressed: _showModuleSelector,
              icon: const Icon(Icons.apps_rounded),
            ),
          NotificationButton(data: data, user: moduleUser),
          IconButton(
            tooltip: 'My profile',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => ProfileScreen(user: _user)),
            ),
            icon: const CircleAvatar(
              radius: 18,
              backgroundColor: Color(0xFFE3ECF8),
              child: Icon(Icons.person_rounded, color: Palette.muted),
            ),
          ),
        ],
      ),
      body: data == null
          ? const Center(child: CircularProgressIndicator())
          : isFacultyModule
          ? FacultyMobileView(data: data, tabIndex: _tabIndex, user: _user)
          : StudentMobileView(data: data),
      bottomNavigationBar: isFacultyModule
          ? _buildFacultyNavigationBar()
          : null,
    );
  }

  Future<void> _showModuleSelector() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Choose module',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              const Text(
                'Switch between the modules available to your account.',
                style: TextStyle(color: Palette.muted),
              ),
              const SizedBox(height: 18),
              if (_user.canAccessFaculty)
                _ModuleChoice(
                  title: 'Faculty Module',
                  subtitle: 'Faculty tracker, rooms, and your schedule',
                  icon: Icons.school_rounded,
                  selected: _activeModule == 'faculty',
                  onTap: () => Navigator.pop(context, 'faculty'),
                ),
              if (_user.canAccessStudent) ...[
                const SizedBox(height: 10),
                _ModuleChoice(
                  title: 'Student Module',
                  subtitle: 'View faculty locations and schedules',
                  icon: Icons.person_search_rounded,
                  selected: _activeModule == 'student',
                  onTap: () => Navigator.pop(context, 'student'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
    if (!mounted || selected == null || selected == _activeModule) return;
    setState(() {
      _activeModule = selected;
      _tabIndex = 0;
    });
  }

  NavigationBar _buildFacultyNavigationBar() {
    const destinations = [
      NavigationDestination(
        icon: Icon(Icons.people_alt_rounded),
        label: 'Faculty',
      ),
      NavigationDestination(
        icon: Icon(Icons.meeting_room_rounded),
        label: 'Rooms',
      ),
      NavigationDestination(
        icon: Icon(Icons.event_note_rounded),
        label: 'My Schedule',
      ),
    ];
    return NavigationBar(
      elevation: 8,
      selectedIndex: _tabIndex.clamp(0, destinations.length - 1),
      onDestinationSelected: (index) => setState(() => _tabIndex = index),
      destinations: destinations,
    );
  }
}

class _ModuleChoice extends StatelessWidget {
  const _ModuleChoice({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? const Color(0xFFEAF1FF) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(
          color: selected ? Palette.blue : Palette.border,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            children: [
              _IconBox(icon: icon, color: Palette.blue),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Palette.text,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: Palette.muted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                selected
                    ? Icons.check_circle_rounded
                    : Icons.chevron_right_rounded,
                color: selected ? Palette.blue : Palette.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class FacultyMobileView extends StatelessWidget {
  const FacultyMobileView({
    super.key,
    required this.data,
    required this.tabIndex,
    required this.user,
  });

  final AppData data;
  final int tabIndex;
  final AppUser user;

  @override
  Widget build(BuildContext context) {
    final ownFacultyId = user.facultyId ?? '';
    final ownSchedules = schedulesForFacultyUser(data.schedules, user);
    if (tabIndex == 1) return RoomsList(data: data);
    if (tabIndex == 2) {
      return SchedulesList(
        schedules: ownSchedules,
        emptyMessage: ownFacultyId.isEmpty
            ? 'No faculty profile is linked to this account.'
            : 'No schedules assigned to you.',
      );
    }
    return FacultyStatusList(data: data, showRooms: true);
  }
}

class StudentMobileView extends StatelessWidget {
  const StudentMobileView({super.key, required this.data});

  final AppData data;

  @override
  Widget build(BuildContext context) {
    return FacultyStatusList(data: data, showRooms: true, studentView: true);
  }
}

class FacultyStatusList extends StatefulWidget {
  const FacultyStatusList({
    super.key,
    required this.data,
    required this.showRooms,
    this.studentView = false,
  });

  final AppData data;
  final bool showRooms;
  final bool studentView;

  @override
  State<FacultyStatusList> createState() => _FacultyStatusListState();
}

class _FacultyStatusListState extends State<FacultyStatusList> {
  String search = '';
  String status = 'All';

  @override
  Widget build(BuildContext context) {
    final filtered = widget.data.facultyLocations.where((faculty) {
      final term = search.toLowerCase();
      return (status == 'All' || faculty.status == status) &&
          (term.isEmpty ||
              [
                faculty.name,
                faculty.department,
                faculty.subject,
              ].any((value) => value.toLowerCase().contains(term)));
    }).toList();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _HeroCard(
          title: widget.studentView ? 'Faculty Status' : 'Faculty Tracker',
          subtitle: widget.studentView
              ? "View each faculty member's current room and subject."
              : 'Live faculty location and class status.',
          icon: Icons.people_alt_rounded,
        ),
        const SizedBox(height: 16),
        SearchAndStatus(
          search: search,
          status: status,
          statuses: const ['All', 'In-Class', 'Available', 'Offline'],
          onSearch: (v) => setState(() => search = v),
          onStatus: (v) => setState(() => status = v),
        ),
        const SizedBox(height: 12),
        ...filtered.map(
          (faculty) => FacultyTile(
            faculty: faculty,
            showRoom: widget.showRooms,
            onTap: () => showScheduleSheet(
              context,
              faculty,
              widget.data.schedules
                  .where((s) => s.facultyId == faculty.id)
                  .toList(),
            ),
          ),
        ),
        if (filtered.isEmpty) const EmptyState(message: 'No faculty found.'),
      ],
    );
  }
}

class RoomsList extends StatelessWidget {
  const RoomsList({super.key, required this.data});

  final AppData data;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _HeroCard(
          title: 'Room Tracker',
          subtitle: 'Availability, reservations, and maintenance status.',
          icon: Icons.meeting_room_rounded,
        ),
        const SizedBox(height: 16),
        ...data.roomLocations.map((room) => RoomTile(room: room)),
      ],
    );
  }
}

class SchedulesList extends StatelessWidget {
  const SchedulesList({
    super.key,
    required this.schedules,
    this.emptyMessage = 'No schedules found.',
  });

  final List<ScheduleEntry> schedules;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _HeroCard(
          title: 'My Schedule',
          subtitle: 'Classes assigned from the active schedule.',
          icon: Icons.event_note_rounded,
        ),
        const SizedBox(height: 16),
        ...schedules.map((schedule) => ScheduleTile(schedule: schedule)),
        if (schedules.isEmpty) EmptyState(message: emptyMessage),
      ],
    );
  }
}

class FacultyTile extends StatelessWidget {
  const FacultyTile({
    super.key,
    required this.faculty,
    this.showRoom = true,
    this.onTap,
  });

  final FacultyLocation faculty;
  final bool showRoom;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = faculty.status == 'In-Class'
        ? Palette.blue
        : faculty.status == 'Available'
        ? Palette.success
        : Palette.muted;
    return _Panel(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _InitialAvatar(name: faculty.name, color: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        faculty.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      Text(
                        faculty.department,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(color: Palette.blue),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusChip(label: faculty.statusLabel, color: color),
              ],
            ),
            const Divider(height: 26),
            _InfoLine(
              icon: Icons.school_outlined,
              label: 'Current subject',
              value: faculty.subject,
            ),
            if (showRoom) ...[
              const SizedBox(height: 10),
              _InfoLine(
                icon: Icons.location_on_outlined,
                label: 'Current room',
                value: faculty.room.isEmpty ? 'Not in room' : faculty.room,
              ),
            ],
            if (faculty.hasClass) ...[
              const SizedBox(height: 10),
              _InfoLine(
                icon: Icons.schedule_rounded,
                label: 'Class time',
                value: '${faculty.startTime} - ${faculty.endTime}',
              ),
            ],
            if (onTap != null) ...[
              const Divider(height: 26),
              const Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    'View schedule',
                    style: TextStyle(
                      color: Palette.blue,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(Icons.chevron_right_rounded, color: Palette.blue),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class RoomTile extends StatelessWidget {
  const RoomTile({super.key, required this.room});

  final RoomLocation room;

  @override
  Widget build(BuildContext context) {
    final color = switch (room.status) {
      'Occupied' => Palette.danger,
      'Reserved' => Palette.purple,
      'Under Maintenance' => Palette.warning,
      _ => Palette.success,
    };
    return _Panel(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _IconBox(icon: Icons.meeting_room_rounded, color: color),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      room.room,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    if (room.building.isNotEmpty || room.floor.isNotEmpty)
                      Text(
                        [
                          room.building,
                          room.floor,
                        ].where((value) => value.isNotEmpty).join(' • '),
                        style: const TextStyle(color: Palette.muted),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusChip(label: room.status, color: color),
            ],
          ),
          if (room.occupants.isNotEmpty) ...[
            const Divider(height: 26),
            _InfoLine(
              icon: Icons.person_outline_rounded,
              label: 'Currently using room',
              value: room.occupants.map((o) => o.name).join(', '),
            ),
          ],
        ],
      ),
    );
  }
}

// Kept isolated for compatibility with older widget snapshots.
// ignore: unused_element
class _LegacyScheduleTile extends StatelessWidget {
  const _LegacyScheduleTile({required this.schedule});

  final ScheduleEntry schedule;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const CircleAvatar(
          backgroundColor: Color(0xFFEFF6FF),
          child: Icon(Icons.event_available_rounded, color: Palette.blue),
        ),
        title: Text(
          schedule.subject,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        subtitle: Text(
          '${schedule.facultyName}\n${schedule.day} • ${schedule.section}\n${schedule.room}',
        ),
        trailing: Text(
          '${schedule.startTime}\n${schedule.endTime}',
          textAlign: TextAlign.right,
          style: const TextStyle(
            color: Palette.blue,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }
}

class ScheduleTile extends StatelessWidget {
  const ScheduleTile({super.key, required this.schedule});

  final ScheduleEntry schedule;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _IconBox(
                icon: Icons.event_available_rounded,
                color: Palette.blue,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      schedule.subject,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      schedule.facultyName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Palette.muted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 26),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaChip(icon: Icons.today_rounded, label: schedule.day),
              _MetaChip(icon: Icons.groups_outlined, label: schedule.section),
              _MetaChip(
                icon: Icons.meeting_room_outlined,
                label: schedule.room,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.schedule_rounded, size: 18, color: Palette.blue),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  '${schedule.startTime} - ${schedule.endTime}',
                  style: const TextStyle(
                    color: Palette.blue,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class SearchAndStatus extends StatelessWidget {
  const SearchAndStatus({
    super.key,
    required this.search,
    required this.status,
    required this.statuses,
    required this.onSearch,
    required this.onStatus,
  });

  final String search;
  final String status;
  final List<String> statuses;
  final ValueChanged<String> onSearch;
  final ValueChanged<String> onStatus;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Column(
        children: [
          TextField(
            onChanged: onSearch,
            decoration: const InputDecoration(
              hintText: 'Search',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: statuses
                .map(
                  (item) => ChoiceChip(
                    label: Text(item),
                    selected: status == item,
                    onSelected: (_) => onStatus(item),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

class NotificationButton extends StatefulWidget {
  const NotificationButton({super.key, required this.data, required this.user});

  final AppData? data;
  final AppUser user;

  @override
  State<NotificationButton> createState() => _NotificationButtonState();
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.user});

  final AppUser user;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _changingPassword = false;

  Future<MapEntry<String, Map<String, dynamic>>?> _findUserRecord() async {
    final snapshot = await locatorDatabase.ref('users').get();
    final users = asMap(snapshot.value);
    for (final entry in users.entries) {
      final record = asStringMap(entry.value);
      if (entry.key.toString() == widget.user.uid ||
          firstText(record, ['user_id', 'uid']) == widget.user.uid) {
        return MapEntry(entry.key.toString(), record);
      }
    }
    return null;
  }

  Future<void> _changePassword() async {
    final currentController = TextEditingController();
    final nextController = TextEditingController();
    final confirmController = TextEditingController();
    String? validationMessage;

    final values = await showDialog<List<String>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Change password'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: currentController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  decoration: const InputDecoration(
                    labelText: 'Current password',
                    prefixIcon: Icon(Icons.lock_outline_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: nextController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: const InputDecoration(
                    labelText: 'New password',
                    prefixIcon: Icon(Icons.key_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: confirmController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: const InputDecoration(
                    labelText: 'Confirm new password',
                    prefixIcon: Icon(Icons.verified_user_outlined),
                  ),
                ),
                if (validationMessage != null) ...[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      validationMessage!,
                      style: const TextStyle(
                        color: Palette.danger,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final currentPassword = currentController.text;
                final newPassword = nextController.text;
                final confirmPassword = confirmController.text;
                String? message;
                if (currentPassword.isEmpty) {
                  message = 'Enter your current password.';
                } else if (newPassword.length < 8) {
                  message = 'Password must be at least 8 characters.';
                } else if (newPassword != confirmPassword) {
                  message = 'Passwords do not match.';
                } else if (newPassword == currentPassword) {
                  message =
                      'Use a password different from your current password.';
                }
                if (message != null) {
                  setDialogState(() => validationMessage = message);
                  return;
                }
                Navigator.of(dialogContext).pop([currentPassword, newPassword]);
              },
              child: const Text('Save password'),
            ),
          ],
        ),
      ),
    );

    currentController.dispose();
    nextController.dispose();
    confirmController.dispose();
    if (values == null || !mounted) return;

    setState(() => _changingPassword = true);
    try {
      final record = await _findUserRecord();
      if (record == null) {
        throw Exception('Your user record could not be found.');
      }

      final authUser = locatorAuth.currentUser;
      if (authUser != null) {
        final email = authUser.email ?? widget.user.username;
        final credential = EmailAuthProvider.credential(
          email: email,
          password: values[0],
        );
        await authUser.reauthenticateWithCredential(credential);
        await authUser.updatePassword(values[1]);
      } else {
        final storedPassword = str(record.value['password']);
        if (storedPassword.isEmpty ||
            storedPassword == 'managed_by_firebase_auth') {
          throw Exception(
            'Sign out and sign in again before changing your password.',
          );
        }
        if (storedPassword != values[0]) {
          throw FirebaseAuthException(
            code: 'wrong-password',
            message: 'Your current password is incorrect.',
          );
        }
      }

      await locatorDatabase.ref('users/${record.key}').update({
        'password': authUser == null ? values[1] : 'managed_by_firebase_auth',
        'password_updated_at': DateTime.now().toUtc().toIso8601String(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password updated successfully.')),
      );
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      final message = switch (error.code) {
        'invalid-credential' ||
        'wrong-password' => 'Your current password is incorrect.',
        'weak-password' =>
          'Use a stronger password with at least 8 characters.',
        'too-many-requests' =>
          'Too many attempts. Wait a moment, then try again.',
        'network-request-failed' =>
          'Check your internet connection and try again.',
        _ => error.message ?? 'Password update failed.',
      };
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) setState(() => _changingPassword = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        children: [
          _Panel(
            child: Column(
              children: [
                _InitialAvatar(name: user.name, color: Palette.blue, size: 72),
                const SizedBox(height: 14),
                Text(
                  user.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user.username,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Palette.muted),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.center,
                  children: user.roleIds
                      .map(
                        (role) => StatusChip(
                          label: '${role[0].toUpperCase()}${role.substring(1)}',
                          color: Palette.blue,
                        ),
                      )
                      .toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Account Information',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 18),
                _InfoLine(
                  icon: Icons.badge_outlined,
                  label: 'User ID',
                  value: user.uid,
                ),
                const SizedBox(height: 14),
                _InfoLine(
                  icon: Icons.alternate_email_rounded,
                  label: 'Username',
                  value: user.username,
                ),
                if ((user.facultyId ?? '').isNotEmpty) ...[
                  const SizedBox(height: 14),
                  _InfoLine(
                    icon: Icons.school_outlined,
                    label: 'Faculty ID',
                    value: user.facultyId!,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _changingPassword ? null : _changePassword,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(50),
            ),
            icon: _changingPassword
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.key_rounded),
            label: Text(
              _changingPassword ? 'Updating password...' : 'Change password',
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => returnToLogin(context),
            style: OutlinedButton.styleFrom(
              foregroundColor: Palette.danger,
              side: const BorderSide(color: Palette.danger),
              minimumSize: const Size.fromHeight(50),
            ),
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sign out'),
          ),
        ],
      ),
    );
  }
}

class _IconBox extends StatelessWidget {
  const _IconBox({required this.icon, required this.color, this.size = 46});

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: .09),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, color: color, size: size * .48),
    );
  }
}

class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({
    required this.name,
    required this.color,
    this.size = 48,
  });

  final String name;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final initials = parts
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0].toUpperCase())
        .join();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: .11),
        shape: BoxShape.circle,
      ),
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: TextStyle(
          color: color,
          fontSize: size * .34,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: Palette.blue),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: const TextStyle(
                  color: Palette.muted,
                  fontSize: 10,
                  letterSpacing: .8,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value.isEmpty ? 'Not available' : value,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F6FA),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Palette.muted),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Palette.muted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationButtonState extends State<NotificationButton> {
  final GlobalKey _buttonKey = GlobalKey();
  final Set<String> _read = {};
  final Set<String> _cleared = {};

  List<Map<String, dynamic>> get _notifications =>
      notificationsForUser(widget.data, widget.user);

  List<Map<String, dynamic>> get _visibleNotifications => _notifications
      .where(
        (item) =>
            !_cleared.contains(notificationKey(item, widget.user.mobileRole)),
      )
      .toList();

  void _markAllRead() {
    setState(() {
      _read.addAll(
        _visibleNotifications.map(
          (item) => notificationKey(item, widget.user.mobileRole),
        ),
      );
    });
  }

  void _clearAll() {
    setState(() {
      final keys = _visibleNotifications.map(
        (item) => notificationKey(item, widget.user.mobileRole),
      );
      _cleared.addAll(keys);
      _read.addAll(_cleared);
    });
  }

  Future<void> _openNotifications() async {
    final button = _buttonKey.currentContext?.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context).context.findRenderObject() as RenderBox?;
    if (button == null || overlay == null) return;
    final offset = button.localToGlobal(Offset.zero, ancestor: overlay);
    final items = _visibleNotifications;
    final unreadCount = items.where((item) {
      final key = notificationKey(item, widget.user.mobileRole);
      return !_read.contains(key);
    }).length;

    await showMenu<void>(
      context: context,
      position: RelativeRect.fromRect(
        Rect.fromLTWH(
          offset.dx + button.size.width - 360,
          offset.dy + button.size.height + 4,
          360,
          0,
        ),
        Offset.zero & overlay.size,
      ),
      constraints: const BoxConstraints(minWidth: 320, maxWidth: 360),
      items: [
        PopupMenuItem<void>(
          enabled: false,
          padding: EdgeInsets.zero,
          child: SizedBox(
            width: 360,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 10, 10),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Notifications',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Mark all as read',
                        onPressed: unreadCount == 0
                            ? null
                            : () {
                                Navigator.of(context).pop();
                                _markAllRead();
                              },
                        icon: const Icon(Icons.done_all_rounded, size: 20),
                      ),
                      IconButton(
                        tooltip: 'Clear notifications',
                        onPressed: items.isEmpty
                            ? null
                            : () {
                                Navigator.of(context).pop();
                                _clearAll();
                              },
                        icon: const Icon(Icons.clear_all_rounded, size: 20),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                if (items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 30),
                    child: Text(
                      'No notifications to display.',
                      style: TextStyle(color: Palette.muted),
                    ),
                  )
                else
                  ...items.take(4).map((notification) {
                    final key = notificationKey(
                      notification,
                      widget.user.mobileRole,
                    );
                    return _NotificationTile(
                      notification: notification,
                      unread: !_read.contains(key),
                      compact: true,
                    );
                  }),
                const Divider(height: 1),
                SizedBox(
                  width: double.infinity,
                  child: TextButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => NotificationsScreen(
                            user: widget.user,
                            data: widget.data,
                            initialRead: _read,
                            initialCleared: _cleared,
                            onStateChanged: (read, cleared) {
                              if (!mounted) return;
                              setState(() {
                                _read
                                  ..clear()
                                  ..addAll(read);
                                _cleared
                                  ..clear()
                                  ..addAll(cleared);
                              });
                            },
                          ),
                        ),
                      );
                    },
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 7),
                      child: Text('See all notifications'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final unread = _visibleNotifications.any((item) {
      final key = notificationKey(item, widget.user.mobileRole);
      return !_read.contains(key);
    });
    return Stack(
      children: [
        IconButton(
          key: _buttonKey,
          icon: const Icon(Icons.notifications_rounded),
          tooltip: 'Notifications',
          onPressed: _openNotifications,
        ),
        if (unread)
          const Positioned(
            right: 10,
            top: 10,
            child: CircleAvatar(radius: 4, backgroundColor: Palette.danger),
          ),
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.unread,
    this.compact = false,
  });

  final Map<String, dynamic> notification;
  final bool unread;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final title = str(notification['title']).isEmpty
        ? 'System update'
        : str(notification['title']);
    return Container(
      color: unread ? Palette.blue.withValues(alpha: .055) : null,
      padding: EdgeInsets.fromLTRB(
        16,
        compact ? 12 : 16,
        16,
        compact ? 12 : 16,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 9,
            height: 9,
            margin: const EdgeInsets.only(top: 6),
            decoration: BoxDecoration(
              color: unread ? Palette.blue : Palette.border,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                if (str(notification['message']).isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    str(notification['message']),
                    maxLines: compact ? 2 : null,
                    overflow: compact ? TextOverflow.ellipsis : null,
                    style: const TextStyle(
                      color: Palette.muted,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ],
                const SizedBox(height: 5),
                Text(
                  notificationTimeLabel(notification['time']),
                  style: const TextStyle(color: Palette.muted, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({
    super.key,
    required this.user,
    required this.data,
    required this.initialRead,
    required this.initialCleared,
    required this.onStateChanged,
  });

  final AppUser user;
  final AppData? data;
  final Set<String> initialRead;
  final Set<String> initialCleared;
  final void Function(Set<String> read, Set<String> cleared) onStateChanged;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  late final Set<String> _read = {...widget.initialRead};
  late final Set<String> _cleared = {...widget.initialCleared};
  bool _unreadOnly = false;

  List<Map<String, dynamic>> get _visible {
    final all = notificationsForUser(widget.data, widget.user).where((item) {
      final key = notificationKey(item, widget.user.mobileRole);
      return !_cleared.contains(key);
    });
    if (!_unreadOnly) return all.toList();
    return all
        .where(
          (item) =>
              !_read.contains(notificationKey(item, widget.user.mobileRole)),
        )
        .toList();
  }

  void _sync() => widget.onStateChanged({..._read}, {..._cleared});

  void _markAllRead() {
    setState(() {
      _read.addAll(
        notificationsForUser(
          widget.data,
          widget.user,
        ).map((item) => notificationKey(item, widget.user.mobileRole)),
      );
    });
    _sync();
  }

  void _clearAll() {
    setState(() {
      _cleared.addAll(
        notificationsForUser(
          widget.data,
          widget.user,
        ).map((item) => notificationKey(item, widget.user.mobileRole)),
      );
      _read.addAll(_cleared);
    });
    _sync();
  }

  @override
  Widget build(BuildContext context) {
    final items = _visible;
    final unreadCount = notificationsForUser(widget.data, widget.user)
        .where(
          (item) =>
              !_read.contains(notificationKey(item, widget.user.mobileRole)),
        )
        .length;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            tooltip: 'Mark all as read',
            onPressed: unreadCount == 0 ? null : _markAllRead,
            icon: const Icon(Icons.done_all_rounded),
          ),
          IconButton(
            tooltip: 'Clear notifications',
            onPressed: items.isEmpty ? null : _clearAll,
            icon: const Icon(Icons.clear_all_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: !_unreadOnly,
                  onSelected: (_) => setState(() => _unreadOnly = false),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text('Unread ($unreadCount)'),
                  selected: _unreadOnly,
                  onSelected: (_) => setState(() => _unreadOnly = true),
                ),
              ],
            ),
          ),
          Expanded(
            child: items.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.notifications_none_rounded,
                          size: 44,
                          color: Palette.muted,
                        ),
                        SizedBox(height: 10),
                        Text('No notifications to display.'),
                      ],
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, index) {
                      final item = items[index];
                      final key = notificationKey(item, widget.user.mobileRole);
                      return _Panel(
                        padding: EdgeInsets.zero,
                        child: _NotificationTile(
                          notification: item,
                          unread: !_read.contains(key),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Palette.border),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Palette.navy.withValues(alpha: .05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _IconBox(icon: icon, color: Palette.blue, size: 54),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Palette.text,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(color: Palette.muted, height: 1.35),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({
    required this.child,
    this.margin = EdgeInsets.zero,
    this.padding = const EdgeInsets.all(16),
  });

  final Widget child;
  final EdgeInsets margin;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Palette.border),
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Palette.navy.withValues(alpha: .04),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: child,
    );
  }
}

class StiLogoSmall extends StatelessWidget {
  const StiLogoSmall({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      width: 58,
      child: Image.asset(
        stiLogoAsset,
        fit: BoxFit.contain,
        semanticLabel: 'STI logo',
      ),
    );
  }
}

class _LogoHeader extends StatelessWidget {
  const _LogoHeader({this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const StiLogoSmall(),
        const SizedBox(width: 10),
        Text(
          'STI Locator',
          style: TextStyle(
            fontSize: compact ? 18 : 22,
            color: Palette.text,
            fontWeight: FontWeight.w900,
          ),
        ),
        if (isStaging || isLocal) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF3BF),
              border: Border.all(color: const Color(0xFFF4C430)),
              borderRadius: BorderRadius.circular(5),
            ),
            child: const Text(
              isLocal ? 'LOCAL' : 'STG',
              style: TextStyle(
                color: Color(0xFF7A5200),
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: .6,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Center(
        child: Text(message, style: const TextStyle(color: Palette.muted)),
      ),
    );
  }
}

void returnToLogin(BuildContext context) {
  Navigator.of(context, rootNavigator: true).pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const LoginScreen()),
    (_) => false,
  );
  unawaited(_clearFirebaseSession());
}

Future<void> _clearFirebaseSession() async {
  try {
    await locatorAuth.signOut().timeout(const Duration(seconds: 3));
  } catch (_) {
    // The local session has already ended. A network/auth cleanup failure must
    // not trap the user inside the authenticated mobile shell.
  }
}

AppUser? refreshMobileUser(Map<String, dynamic> raw, AppUser current) {
  final users = asMap(raw['users']);
  Map<String, dynamic>? user;
  String recordKey = '';

  for (final entry in users.entries) {
    final candidate = asStringMap(entry.value);
    final candidateId = firstText(candidate, ['user_id', 'uid']);
    final candidateUsername = firstText(candidate, ['username', 'email']);
    if (entry.key.toString() == current.uid ||
        candidateId == current.uid ||
        (candidateUsername.isNotEmpty &&
            candidateUsername.toLowerCase() ==
                current.username.toLowerCase())) {
      user = candidate;
      recordKey = entry.key.toString();
      break;
    }
  }

  if (user == null || str(user['status']).toLowerCase() == 'inactive') {
    return null;
  }

  final uid = firstText(user, ['user_id', 'uid']).isNotEmpty
      ? firstText(user, ['user_id', 'uid'])
      : recordKey;
  final username = firstText(user, ['username', 'email']).isNotEmpty
      ? firstText(user, ['username', 'email'])
      : current.username;
  final roleIds = listOfStrings(user['role_ids']).isEmpty
      ? [str(user['role_id']).isEmpty ? 'student' : str(user['role_id'])]
      : listOfStrings(user['role_ids']);
  final permissions = permissionMapFromRoles(
    asMap(raw['role_permissions']),
    roleIds,
  );
  for (final record in asMap(raw['user_permissions']).values) {
    final override = asStringMap(record);
    if (str(override['user_id']) == uid) {
      permissions[str(override['permission_id'])] = override['allowed'] == true;
    }
  }

  final faculties = asMap(raw['faculties']);
  final students = asMap(raw['students']);
  final facultyProfile = findProfile(faculties, uid, username, [
    'user_id',
    'email',
    'username',
    'faculty_id',
  ]);
  final studentProfile = findProfile(students, uid, username, [
    'user_id',
    'email',
    'username',
    'student_number',
    'student_id',
  ]);
  final profile = facultyProfile.isNotEmpty
      ? facultyProfile
      : studentProfile.isNotEmpty
      ? studentProfile
      : <String, dynamic>{};

  return AppUser(
    uid: uid,
    name: displayName(profile, fallback: username),
    username: username,
    roleIds: roleIds,
    userType: roleIds.firstOrNull ?? 'student',
    permissions: permissions,
    facultyId: str(facultyProfile['faculty_id']).isNotEmpty
        ? str(facultyProfile['faculty_id'])
        : current.facultyId,
  );
}

Future<AppUser?> authenticateMobileUser(
  String login,
  String password,
  Map<String, dynamic> raw,
) async {
  final users = asMap(raw['users']);
  final roles = asMap(raw['role_permissions']);
  final overrides = asMap(raw['user_permissions']);
  final faculties = asMap(raw['faculties']);
  final students = asMap(raw['students']);

  for (final entry in users.entries) {
    final user = asStringMap(entry.value);
    final username = str(user['username']);
    final uid = str(user['user_id']).isNotEmpty
        ? str(user['user_id'])
        : entry.key.toString();
    final loginKey = login.toLowerCase();
    if (username.toLowerCase() != login.toLowerCase() &&
        uid.toLowerCase() != loginKey &&
        str(user['email']).toLowerCase() != loginKey) {
      continue;
    }
    if (str(user['status']).toLowerCase() == 'inactive') {
      return null;
    }
    final storedPassword = str(user['password']);
    if (storedPassword == 'managed_by_firebase_auth') {
      try {
        final authEmail = username.isNotEmpty ? username : str(user['email']);
        await locatorAuth.signInWithEmailAndPassword(
          email: authEmail,
          password: password,
        );
      } on FirebaseAuthException {
        return null;
      }
    } else {
      if (storedPassword.isEmpty || storedPassword != password) continue;
    }

    final roleIds = listOfStrings(user['role_ids']).isEmpty
        ? [str(user['role_id']).isEmpty ? 'student' : str(user['role_id'])]
        : listOfStrings(user['role_ids']);
    final permissions = permissionMapFromRoles(roles, roleIds);
    for (final record in overrides.values) {
      final map = asStringMap(record);
      if (str(map['user_id']) == uid) {
        permissions[str(map['permission_id'])] = map['allowed'] == true;
      }
    }
    final primaryRole = roleIds.firstOrNull ?? 'student';
    final facultyProfile = findProfile(faculties, uid, username, [
      'user_id',
      'email',
      'username',
      'faculty_id',
    ]);
    final studentProfile = findProfile(students, uid, username, [
      'user_id',
      'email',
      'username',
      'student_number',
      'student_id',
    ]);
    final profile = facultyProfile.isNotEmpty
        ? facultyProfile
        : studentProfile.isNotEmpty
        ? studentProfile
        : <String, dynamic>{};
    return AppUser(
      uid: uid,
      name: displayName(profile, fallback: username),
      username: username,
      roleIds: roleIds,
      userType: primaryRole,
      permissions: permissions,
      facultyId: str(facultyProfile['faculty_id']),
    );
  }
  return null;
}

Map<String, bool> permissionMapFromRoles(
  Map<String, dynamic> rolePermissions,
  List<String> roleIds,
) {
  final result = <String, bool>{};
  for (final record in rolePermissions.values) {
    final map = asStringMap(record);
    if (roleIds.contains(str(map['role_id']))) {
      result[str(map['permission_id'])] = true;
    }
  }
  return result;
}

void showProfile(BuildContext context, AppUser user) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    builder: (_) => Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'My Profile',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          Text('Name: ${user.name}'),
          Text('Username: ${user.username}'),
          Text('Roles: ${user.roleIds.join(', ')}'),
        ],
      ),
    ),
  );
}

void showScheduleSheet(
  BuildContext context,
  FacultyLocation faculty,
  List<ScheduleEntry> schedules,
) {
  showModalBottomSheet(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .72,
      minChildSize: .4,
      maxChildSize: .92,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(18),
        children: [
          Text(
            faculty.name,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            faculty.department,
            style: const TextStyle(color: Palette.muted),
          ),
          const SizedBox(height: 16),
          ...schedules.map((schedule) => ScheduleTile(schedule: schedule)),
          if (schedules.isEmpty)
            const EmptyState(message: 'No schedule assigned.'),
        ],
      ),
    ),
  );
}

Map<String, dynamic> asMap(dynamic value) {
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return {};
}

Map<String, dynamic> asStringMap(dynamic value) => asMap(value);
String str(dynamic value) => value?.toString().trim() ?? '';
List<String> listOfStrings(dynamic value) =>
    value is List ? value.map(str).where((v) => v.isNotEmpty).toList() : [];

String firstText(Map<String, dynamic> record, List<String> fields) {
  for (final field in fields) {
    final value = str(record[field]);
    if (value.isNotEmpty) return value;
  }
  return '';
}

String normalizeLookup(String value) =>
    value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '');

List<ScheduleEntry> schedulesForFacultyUser(
  List<ScheduleEntry> schedules,
  AppUser user,
) {
  final facultyId = (user.facultyId ?? '').trim();
  if (facultyId.isNotEmpty) {
    return schedules
        .where((schedule) => schedule.facultyId == facultyId)
        .toList();
  }

  final facultyName = normalizeLookup(user.name);
  if (facultyName.isEmpty) return [];
  return schedules
      .where(
        (schedule) =>
            normalizeLookup(schedule.facultyName).isNotEmpty &&
            normalizeLookup(schedule.facultyName) == facultyName,
      )
      .toList();
}

String? loginValidationMessage(String email, String password) {
  final normalizedEmail = email.trim();
  if (normalizedEmail.isEmpty) return 'Enter your school email address.';
  if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(normalizedEmail)) {
    return 'Enter a valid school email address.';
  }
  if (password.isEmpty) return 'Enter your password.';
  if (password.length < 6) {
    return 'Password must contain at least 6 characters.';
  }
  return null;
}

Map<String, dynamic> findById(
  Map<String, dynamic> collection,
  String id,
  String field,
) {
  if (id.isEmpty) return {};
  if (collection[id] is Map) return asStringMap(collection[id]);
  return collection.values
      .whereType<Map>()
      .map(asStringMap)
      .firstWhere((item) => str(item[field]) == id, orElse: () => {});
}

Map<String, dynamic> findByField(
  Map<String, dynamic> collection,
  String value,
  String field,
) {
  if (value.isEmpty) return {};
  return collection.values
      .whereType<Map>()
      .map(asStringMap)
      .firstWhere((item) => str(item[field]) == value, orElse: () => {});
}

Map<String, dynamic> findProfile(
  Map<String, dynamic> collection,
  String uid,
  String username,
  List<String> fields,
) {
  final candidates = {uid, username}
      .map((value) => value.toLowerCase().trim())
      .where((value) => value.isNotEmpty)
      .toSet();
  if (candidates.isEmpty) return {};

  for (final entry in collection.entries) {
    final item = asStringMap(entry.value);
    final key = entry.key.toString().toLowerCase().trim();
    if (candidates.contains(key)) return item;

    for (final field in fields) {
      final value = str(item[field]).toLowerCase();
      if (candidates.contains(value)) return item;
    }
  }
  return {};
}

String displayName(Map<String, dynamic> record, {required String fallback}) {
  final name = [
    record['first_name'],
    record['middle_name'],
    record['last_name'],
  ].map(str).where((value) => value.isNotEmpty).join(' ');
  return name.isEmpty ? fallback : name;
}

String floorFromRoom(String room) {
  final clean = room
      .replaceAll(RegExp(r'^(RM|LAB|ROOM)\s*', caseSensitive: false), '')
      .trim();
  if (clean == '101') return 'Ground Floor';
  final floor = int.tryParse(clean.isEmpty ? '' : clean[0]);
  if (floor == null) return 'Not Available';
  final suffix = floor == 1
      ? 'st'
      : floor == 2
      ? 'nd'
      : floor == 3
      ? 'rd'
      : 'th';
  return '$floor$suffix Floor';
}

ScheduleEntry? currentScheduleFor(
  List<ScheduleEntry> schedules,
  String facultyId,
) {
  for (final schedule in schedules.where((s) => s.facultyId == facultyId)) {
    if (isScheduleNow(schedule)) return schedule;
  }
  return null;
}

bool isScheduleNow(ScheduleEntry schedule) {
  final now = DateTime.now();
  final today = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ][now.weekday - 1];
  if (!normalizeDays(schedule.day).contains(today)) return false;
  final start = parseMinutes(schedule.startTime);
  final end = parseMinutes(schedule.endTime);
  if (start == null || end == null) return false;
  final current = now.hour * 60 + now.minute;
  return end < start
      ? current >= start || current <= end
      : current >= start && current <= end;
}

List<String> normalizeDays(String value) {
  final compact = value.toUpperCase().replaceAll(RegExp(r'[^A-Z]'), '');
  if (compact == 'TTH' || compact == 'TUTH') return ['Tuesday', 'Thursday'];
  if (compact == 'MWF') return ['Monday', 'Wednesday', 'Friday'];
  final map = {
    'M': 'Monday',
    'MON': 'Monday',
    'T': 'Tuesday',
    'TU': 'Tuesday',
    'TUE': 'Tuesday',
    'W': 'Wednesday',
    'WED': 'Wednesday',
    'TH': 'Thursday',
    'THU': 'Thursday',
    'F': 'Friday',
    'FRI': 'Friday',
    'SA': 'Saturday',
    'SAT': 'Saturday',
    'SU': 'Sunday',
    'SUN': 'Sunday',
  };
  return value
      .replaceAll(RegExp(r'\band\b', caseSensitive: false), ',')
      .split(RegExp(r'[,/&+\-\s]+'))
      .map((p) => map[p.toUpperCase()] ?? '')
      .where((p) => p.isNotEmpty)
      .toList();
}

int? parseMinutes(String value) {
  final cleaned = value
      .trim()
      .toUpperCase()
      .replaceAll(RegExp(r'\s+'), ' ')
      .replaceAllMapped(RegExp(r'(\d)(AM|PM)$'), (m) => '${m[1]} ${m[2]}');
  final match = RegExp(
    r'^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$',
  ).firstMatch(cleaned);
  if (match == null) return null;
  var hour = int.parse(match[1]!);
  final minute = int.parse(match[2] ?? '0');
  final meridiem = match[3];
  if (meridiem == 'PM' && hour < 12) hour += 12;
  if (meridiem == 'AM' && hour == 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

extension FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
