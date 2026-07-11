import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_app/main.dart';

void main() {
  testWidgets('login page renders and validates required fields', (
    tester,
  ) async {
    await tester.pumpWidget(const MyApp());

    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
    expect(find.byIcon(Icons.alternate_email_rounded), findsOneWidget);
    expect(find.byIcon(Icons.lock_outline_rounded), findsOneWidget);

    await tester.tap(find.text('Sign in'));
    await tester.pump();

    expect(find.text('Enter your email address'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
  });

  testWidgets('valid login opens faculty homepage and switches pages', (
    tester,
  ) async {
    await tester.pumpWidget(const MyApp());

    await tester.enterText(find.byType(TextFormField).at(0), 'faculty@sti.edu');
    await tester.enterText(find.byType(TextFormField).at(1), 'password123');
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 950));
    await tester.pumpAndSettle();

    expect(find.text('Faculty Locator'), findsWidgets);
    expect(
      find.text('Search faculty by name, status, and assigned room.'),
      findsOneWidget,
    );
    expect(find.textContaining('RM201'), findsWidgets);
    expect(find.textContaining('2nd floor'), findsWidgets);
    expect(find.text('Engr. Mark Santos'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Ana');
    await tester.pumpAndSettle();

    expect(find.text('Prof. Ana Reyes'), findsOneWidget);
    expect(find.text('Engr. Mark Santos'), findsNothing);

    await tester.tap(find.widgetWithText(ChoiceChip, 'In class'));
    await tester.pumpAndSettle();

    expect(find.text('No faculty found'), findsOneWidget);

    await tester.tap(find.byTooltip('Clear search'));
    await tester.pumpAndSettle();

    expect(find.text('Engr. Mark Santos'), findsOneWidget);
    expect(find.textContaining('RM204'), findsWidgets);

    await tester.tap(find.text('Rooms'));
    await tester.pumpAndSettle();

    expect(
      find.text('Choose a floor and view its assigned rooms.'),
      findsOneWidget,
    );
    expect(find.text('RM101'), findsOneWidget);
    expect(find.text('RM104'), findsOneWidget);
    expect(find.text('RM105'), findsOneWidget);
    expect(find.text('RM112'), findsOneWidget);
    expect(find.text('RM201'), findsNothing);
    expect(find.byKey(const ValueKey('floor-page-1')), findsOneWidget);
    expect(find.byKey(const ValueKey('floor-page-2')), findsOneWidget);
    expect(find.byKey(const ValueKey('floor-page-3')), findsOneWidget);
    expect(find.byKey(const ValueKey('floor-page-6')), findsOneWidget);

    await tester.tap(find.byTooltip('Next floor'));
    await tester.pumpAndSettle();

    expect(find.text('RM201'), findsOneWidget);
    expect(find.text('RM204'), findsOneWidget);
    expect(find.text('RM212'), findsOneWidget);
    expect(find.text('RM101'), findsNothing);

    await tester.tap(find.byTooltip('Previous floor'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('floor-page-3')));
    await tester.pumpAndSettle();

    expect(find.text('RM301'), findsOneWidget);
    expect(find.text('RM312'), findsOneWidget);
    expect(find.text('RM101'), findsNothing);

    await tester.tap(find.text('Schedules').first);
    await tester.pumpAndSettle();

    expect(
      find.text(
        'Keep track of classes, consultation hours, and room bookings.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('dashboard works on a narrow mobile viewport', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MyApp());
    await tester.enterText(find.byType(TextFormField).at(0), 'faculty@sti.edu');
    await tester.enterText(find.byType(TextFormField).at(1), 'password123');
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 950));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Rooms'));
    await tester.pumpAndSettle();

    expect(find.text('RM101'), findsOneWidget);
    expect(find.text('RM104'), findsOneWidget);
    expect(find.text('RM105'), findsOneWidget);

    await tester.tap(find.byTooltip('Next floor'));
    await tester.pumpAndSettle();

    expect(find.text('RM201'), findsOneWidget);
    expect(find.text('RM204'), findsOneWidget);
    expect(find.text('RM101'), findsNothing);
  });
}
