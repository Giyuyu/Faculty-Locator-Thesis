import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_app/main.dart';

void main() {
  test('faculty schedule filtering uses Faculty ID as the primary match', () {
    const user = AppUser(
      uid: 'user-1',
      name: 'Maria Reyes Santos',
      username: 'maria@sti.edu',
      roleIds: ['faculty'],
      permissions: {},
      userType: 'faculty',
      facultyId: 'NVS0001F',
    );
    const matching = ScheduleEntry(
      scheduleId: 'schedule-1',
      facultyId: 'NVS0001F',
      facultyName: 'Different Imported Name',
      subjectId: 'SUB-1',
      subject: 'Programming 1',
      room: 'RM101',
      day: 'Monday',
      startTime: '8:00 AM',
      endTime: '10:00 AM',
      section: 'IT101',
      term: '1st Term',
      schoolYear: '2026-2027',
    );
    const sameNameWrongId = ScheduleEntry(
      scheduleId: 'schedule-2',
      facultyId: 'NVS9999F',
      facultyName: 'Maria Reyes Santos',
      subjectId: 'SUB-2',
      subject: 'Wrong Assignment',
      room: 'RM102',
      day: 'Tuesday',
      startTime: '1:00 PM',
      endTime: '3:00 PM',
      section: 'IT102',
      term: '1st Term',
      schoolYear: '2026-2027',
    );

    final result = schedulesForFacultyUser([matching, sameNameWrongId], user);

    expect(result, [matching]);
  });

  test('mobile session reflects live role and profile changes', () {
    const current = AppUser(
      uid: 'user-1',
      name: 'Old Name',
      username: 'maria@sti.edu',
      roleIds: ['student'],
      permissions: {},
      userType: 'student',
    );
    final refreshed = refreshMobileUser({
      'users': {
        'user-1': {
          'user_id': 'user-1',
          'username': 'maria@sti.edu',
          'role_ids': ['faculty'],
          'status': 'active',
        },
      },
      'faculties': {
        'faculty-1': {
          'user_id': 'user-1',
          'faculty_id': 'NVS0001F',
          'first_name': 'Maria',
          'last_name': 'Santos',
        },
      },
    }, current);

    expect(refreshed, isNotNull);
    expect(refreshed!.isFaculty, isTrue);
    expect(refreshed.facultyId, 'NVS0001F');
    expect(refreshed.name, 'Maria Santos');
  });

  test('inactive database account invalidates the mobile session', () {
    const current = AppUser(
      uid: 'user-1',
      name: 'Maria Santos',
      username: 'maria@sti.edu',
      roleIds: ['faculty'],
      permissions: {},
      userType: 'faculty',
      facultyId: 'NVS0001F',
    );
    final refreshed = refreshMobileUser({
      'users': {
        'user-1': {
          'user_id': 'user-1',
          'username': 'maria@sti.edu',
          'role_ids': ['faculty'],
          'status': 'inactive',
        },
      },
    }, current);

    expect(refreshed, isNull);
  });

  testWidgets('login page renders the modern sign-in experience', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MyApp());

    expect(find.byKey(const ValueKey('sti-locator-title')), findsOneWidget);
    expect(find.byKey(const ValueKey('sti-login-logo')), findsOneWidget);
    expect(find.text('Welcome Back'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Enter your email'), findsOneWidget);
    expect(
      find.widgetWithText(TextField, 'Enter your password'),
      findsOneWidget,
    );
    expect(find.text('Forgot password?'), findsOneWidget);
    expect(find.textContaining('Secure access'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('notifications are isolated by the signed-in mobile role', () {
    const faculty = AppUser(
      uid: 'faculty-user',
      name: 'Faculty User',
      username: 'faculty@sti.edu',
      roleIds: ['faculty'],
      permissions: {},
      userType: 'faculty',
      facultyId: 'NVS0001F',
    );
    const student = AppUser(
      uid: 'student-user',
      name: 'Student User',
      username: 'student@sti.edu',
      roleIds: ['student'],
      permissions: {},
      userType: 'student',
    );
    final data = AppData.from({
      'notifications': {
        'faculty': {
          'latest': {'audience': 'faculty', 'title': 'Faculty-only update'},
        },
        'student': {
          'latest': {'audience': 'student', 'title': 'Student-only update'},
        },
      },
    });

    expect(notificationForUser(data, faculty)?['title'], 'Faculty-only update');
    expect(notificationForUser(data, student)?['title'], 'Student-only update');
  });

  test('notification history is role-scoped and newest first', () {
    const faculty = AppUser(
      uid: 'faculty-user',
      name: 'Faculty User',
      username: 'faculty@sti.edu',
      roleIds: ['faculty'],
      permissions: {},
      userType: 'faculty',
      facultyId: 'NVS0001F',
    );
    final data = AppData.from({
      'notifications': {
        'faculty': {
          'items': {
            'old': {
              'event_id': 'old',
              'audience': 'faculty',
              'title': 'Older update',
              'time': '2026-07-20T08:00:00.000Z',
            },
            'new': {
              'event_id': 'new',
              'audience': 'faculty',
              'title': 'Newest update',
              'time': '2026-07-21T08:00:00.000Z',
            },
            'wrong-role': {
              'event_id': 'student',
              'audience': 'student',
              'title': 'Student update',
              'time': '2026-07-22T08:00:00.000Z',
            },
          },
        },
      },
    });

    final notifications = notificationsForUser(data, faculty);

    expect(notifications.map((item) => item['title']), [
      'Newest update',
      'Older update',
    ]);
  });

  testWidgets('login adapts to tablet and web viewports', (tester) async {
    for (final size in [const Size(768, 1024), const Size(1440, 900)]) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;

      await tester.pumpWidget(const MyApp());
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('sti-login-logo')), findsOneWidget);
      expect(find.text('Welcome Back'), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  });

  testWidgets('login does not continue when required credentials are missing', (
    tester,
  ) async {
    await tester.pumpWidget(const MyApp());

    final signInButton = find.widgetWithText(FilledButton, 'Sign In');
    await tester.ensureVisible(signInButton);
    await tester.tap(signInButton);
    await tester.pump();
    expect(find.text('Enter your school email address.'), findsOneWidget);
  });

  test('login validation rejects malformed or incomplete credentials', () {
    expect(
      loginValidationMessage('not-an-email', 'password'),
      'Enter a valid school email address.',
    );
    expect(
      loginValidationMessage('faculty@sti.edu', ''),
      'Enter your password.',
    );
    expect(
      loginValidationMessage('faculty@sti.edu', '123'),
      'Password must contain at least 6 characters.',
    );
    expect(loginValidationMessage('faculty@sti.edu', 'Valid123'), isNull);
  });

  testWidgets('faculty status card fits a narrow phone viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const faculty = FacultyLocation(
      id: 'NVS0890F',
      name: 'Eugene Abdullah Musa',
      department: 'Information Technology',
      status: 'In-Class',
      room: 'RM101',
      subject: 'Introduction to Computing',
      hasClass: true,
      startTime: '10:00 AM',
      endTime: '1:00 PM',
      loginTime: '2026-08-09T10:00:00',
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.all(12),
              child: FacultyTile(faculty: faculty),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Eugene Abdullah Musa'), findsOneWidget);
    expect(find.text('Introduction to Computing'), findsOneWidget);
    expect(find.text('RM101'), findsOneWidget);
    expect(find.text('10:00 AM - 1:00 PM'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('schedule card keeps metadata readable on mobile', (
    tester,
  ) async {
    const schedule = ScheduleEntry(
      scheduleId: 'schedule-1',
      facultyId: 'NVS0890F',
      facultyName: 'Eugene Abdullah Musa',
      subjectId: 'SUB-1',
      subject: 'Introduction to Computing',
      room: 'RM101',
      day: 'Tuesday',
      startTime: '10:00 AM',
      endTime: '1:00 PM',
      section: 'IT101',
      term: '1st Term',
      schoolYear: '2026-2027',
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.all(12),
              child: ScheduleTile(schedule: schedule),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Introduction to Computing'), findsOneWidget);
    expect(find.text('Tuesday'), findsOneWidget);
    expect(find.text('IT101'), findsOneWidget);
    expect(find.text('10:00 AM - 1:00 PM'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
