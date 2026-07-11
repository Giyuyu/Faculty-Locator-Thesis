import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:flutter/material.dart';

import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
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
  static const blue = Color(0xFF155EEF);
  static const navy = Color(0xFF172554);
  static const yellow = Color(0xFFFFE500);
  static const bg = Color(0xFFF3F7FC);
  static const text = Color(0xFF111827);
  static const muted = Color(0xFF64748B);
  static const border = Color(0xFFD9E3F0);
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
        colorScheme: ColorScheme.fromSeed(seedColor: Palette.blue),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Palette.text,
          elevation: 0,
          surfaceTintColor: Colors.white,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Palette.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Palette.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Palette.blue, width: 1.5),
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
  bool has(String permission) => isAdmin || permissions[permission] == true;
}

class AppData {
  const AppData({
    required this.raw,
    required this.facultyLocations,
    required this.roomLocations,
    required this.schedules,
    required this.users,
    required this.lastScheduleUpdate,
  });

  final Map<String, dynamic> raw;
  final List<FacultyLocation> facultyLocations;
  final List<RoomLocation> roomLocations;
  final List<ScheduleEntry> schedules;
  final List<UserRow> users;
  final Map<String, dynamic>? lastScheduleUpdate;

  factory AppData.from(dynamic value) {
    final raw = asMap(value);
    final faculties = asMap(raw['faculties']);
    final rooms = asMap(raw['rooms']);
    final subjects = asMap(raw['subjects']);
    final schedulesRaw = asMap(raw['schedules']);
    final statuses = asMap(raw['faculty_status']);
    final sessions = asMap(raw['faculty_login_sessions']);
    final usersRaw = asMap(raw['users']);
    final students = asMap(raw['students']);

    final schedules =
        schedulesRaw.values
            .whereType<Map>()
            .map(
              (item) => ScheduleEntry.fromMap(
                asStringMap(item),
                subjects,
                rooms,
                faculties,
              ),
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
        building: str(room['building']).isEmpty
            ? 'Not Available'
            : str(room['building']),
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

    final users = usersRaw.values.whereType<Map>().map((item) {
      final user = asStringMap(item);
      final uid = str(user['user_id']);
      final roleIds = listOfStrings(user['role_ids']);
      final roleId = str(user['role_id']);
      final profile = roleId == 'student'
          ? findByField(students, uid, 'user_id')
          : findByField(faculties, uid, 'user_id');
      return UserRow(
        uid: uid,
        username: str(user['username']),
        name: displayName(
          profile,
          fallback: str(user['username']).isEmpty ? uid : str(user['username']),
        ),
        roles: roleIds.isEmpty
            ? [roleId.isEmpty ? 'student' : roleId]
            : roleIds,
        status: str(user['status']).isEmpty ? 'active' : str(user['status']),
      );
    }).toList()..sort((a, b) => a.name.compareTo(b.name));

    return AppData(
      raw: raw,
      facultyLocations: facultyLocations,
      roomLocations: roomLocations,
      schedules: schedules,
      users: users,
      lastScheduleUpdate: raw['lastScheduleUpdate'] is Map
          ? asStringMap(raw['lastScheduleUpdate'])
          : null,
    );
  }
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
    required this.semester,
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
  final String semester;
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
      semester: str(schedule['semester']),
      schoolYear: str(schedule['school_year']),
    );
  }
}

class UserRow {
  const UserRow({
    required this.uid,
    required this.username,
    required this.name,
    required this.roles,
    required this.status,
  });

  final String uid;
  final String username;
  final String name;
  final List<String> roles;
  final String status;
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController(text: 'admin@stilocator.local');
  final _password = TextEditingController(text: 'Admin@12345');
  bool _loading = false;
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() => _loading = true);
    try {
      final email = _email.text.trim();
      final password = _password.text;
      final snapshot = await FirebaseDatabase.instance.ref().get();
      final data = AppData.from(snapshot.value);
      final user = await authenticateMobileUser(email, password, data.raw);
      if (!mounted) return;
      if (user == null) {
        _snack('Invalid account or inactive user.');
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
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _LogoHeader(),
                  const SizedBox(height: 28),
                  _Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Welcome Back',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: Palette.text,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Sign in to access STI Locator mobile modules.',
                          style: TextStyle(color: Palette.muted, height: 1.4),
                        ),
                        const SizedBox(height: 24),
                        TextField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'Email or username',
                            prefixIcon: Icon(Icons.alternate_email_rounded),
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _password,
                          obscureText: _obscure,
                          decoration: InputDecoration(
                            labelText: 'Password',
                            prefixIcon: const Icon(Icons.lock_outline_rounded),
                            suffixIcon: IconButton(
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_rounded
                                    : Icons.visibility_off_rounded,
                              ),
                            ),
                          ),
                          onSubmitted: (_) => _login(),
                        ),
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _loading ? null : _login,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(54),
                            backgroundColor: Palette.blue,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: _loading
                              ? const SizedBox.square(
                                  dimension: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Sign In',
                                  style: TextStyle(fontWeight: FontWeight.w800),
                                ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
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

class MobileShell extends StatefulWidget {
  const MobileShell({super.key, required this.user});

  final AppUser user;

  @override
  State<MobileShell> createState() => _MobileShellState();
}

class _MobileShellState extends State<MobileShell> {
  AppData? _data;
  StreamSubscription<DatabaseEvent>? _subscription;
  String? _module;
  int _tabIndex = 0;

  @override
  void initState() {
    super.initState();
    _module = _availableModules.firstOrNull?.id;
    _subscription = FirebaseDatabase.instance.ref().onValue.listen((event) {
      setState(() => _data = AppData.from(event.snapshot.value));
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  List<ModuleOption> get _availableModules {
    final all = <ModuleOption>[
      ModuleOption(
        'admin',
        'Admin',
        Icons.admin_panel_settings_rounded,
        widget.user.has('access_admin_module'),
      ),
      ModuleOption(
        'faculty',
        'Faculty',
        Icons.school_rounded,
        widget.user.has('access_faculty_module'),
      ),
      ModuleOption(
        'student',
        'Student',
        Icons.people_alt_rounded,
        widget.user.has('access_student_module'),
      ),
    ];
    return all.where((module) => module.enabled).toList();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 12,
        title: Row(
          children: const [
            StiLogoSmall(),
            SizedBox(width: 10),
            Text('STI Locator', style: TextStyle(fontWeight: FontWeight.w900)),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => setState(() => _module = null),
            icon: const Icon(Icons.apps_rounded),
            tooltip: 'Modules',
          ),
          NotificationButton(data: data, userKey: widget.user.uid),
          PopupMenuButton<String>(
            icon: const Icon(Icons.account_circle_rounded),
            onSelected: (value) {
              if (value == 'profile') {
                showProfile(context, widget.user);
              }
              if (value == 'logout') {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'profile', child: Text('My profile')),
              PopupMenuDivider(),
              PopupMenuItem(value: 'logout', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      body: data == null
          ? const Center(child: CircularProgressIndicator())
          : _module == null
          ? ModuleSelection(
              modules: _availableModules,
              onSelect: (module) => setState(() => _module = module.id),
            )
          : _buildModule(data),
      bottomNavigationBar: _module == null ? null : _buildNavigationBar(),
    );
  }

  Widget _buildModule(AppData data) {
    if (_module == 'admin') {
      return AdminMobileView(data: data);
    }
    if (_module == 'faculty') {
      return FacultyMobileView(
        data: data,
        tabIndex: _tabIndex,
        user: widget.user,
      );
    }
    return StudentMobileView(data: data);
  }

  NavigationBar? _buildNavigationBar() {
    final destinations = _module == 'admin'
        ? const [
            NavigationDestination(
              icon: Icon(Icons.dashboard_rounded),
              label: 'Dashboard',
            ),
            NavigationDestination(
              icon: Icon(Icons.meeting_room_rounded),
              label: 'Rooms',
            ),
            NavigationDestination(
              icon: Icon(Icons.people_alt_rounded),
              label: 'Users',
            ),
          ]
        : _module == 'faculty'
        ? const [
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
              label: 'Schedules',
            ),
          ]
        : null;
    if (destinations == null) return null;
    return NavigationBar(
      selectedIndex: _tabIndex.clamp(0, destinations.length - 1),
      onDestinationSelected: (index) => setState(() => _tabIndex = index),
      destinations: destinations,
    );
  }
}

class AdminMobileView extends StatelessWidget {
  const AdminMobileView({super.key, required this.data});

  final AppData data;

  @override
  Widget build(BuildContext context) {
    final shell = context.findAncestorStateOfType<_MobileShellState>();
    final tab = shell?._tabIndex ?? 0;
    if (tab == 1) return RoomsList(data: data, canManage: true);
    if (tab == 2) return UsersList(users: data.users);
    final activeFaculty = data.facultyLocations
        .where((f) => f.status != 'Offline')
        .length;
    final occupiedRooms = data.roomLocations
        .where((r) => r.status == 'Occupied')
        .length;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _HeroCard(
          title: 'Admin Dashboard',
          subtitle: 'Live overview of users, rooms, schedules, and activity.',
          icon: Icons.dashboard_rounded,
        ),
        const SizedBox(height: 16),
        _StatsGrid(
          stats: [
            Stat(
              'Faculty',
              '${data.facultyLocations.length}',
              '$activeFaculty active',
              Palette.blue,
            ),
            Stat(
              'Rooms',
              '${data.roomLocations.length}',
              '$occupiedRooms occupied',
              Palette.success,
            ),
            Stat(
              'Schedules',
              '${data.schedules.length}',
              'records',
              Palette.purple,
            ),
            Stat('Users', '${data.users.length}', 'accounts', Palette.warning),
          ],
        ),
        const SizedBox(height: 18),
        const Text(
          'Recent faculty status',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        ...data.facultyLocations.take(6).map((f) => FacultyTile(faculty: f)),
      ],
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
    final ownSchedules = data.schedules.where((schedule) {
      final idMatches =
          ownFacultyId.isNotEmpty && schedule.facultyId == ownFacultyId;
      final nameMatches =
          normalizeLookup(schedule.facultyName).isNotEmpty &&
          normalizeLookup(schedule.facultyName) == normalizeLookup(user.name);
      return idMatches || nameMatches;
    }).toList();
    if (tabIndex == 1) return RoomsList(data: data);
    if (tabIndex == 2) {
      return SchedulesList(
        schedules: user.isAdmin ? data.schedules : ownSchedules,
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
    return FacultyStatusList(data: data, showRooms: false);
  }
}

class FacultyStatusList extends StatefulWidget {
  const FacultyStatusList({
    super.key,
    required this.data,
    required this.showRooms,
  });

  final AppData data;
  final bool showRooms;

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
          title: widget.showRooms ? 'Faculty Tracker' : 'Faculty Status',
          subtitle: widget.showRooms
              ? 'Live faculty location and class status.'
              : 'Tap a faculty card to view their schedule.',
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
  const RoomsList({super.key, required this.data, this.canManage = false});

  final AppData data;
  final bool canManage;

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
        ...data.roomLocations.map(
          (room) => RoomTile(room: room, canManage: canManage),
        ),
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
          title: 'Schedules',
          subtitle: 'Faculty class schedule records.',
          icon: Icons.event_note_rounded,
        ),
        const SizedBox(height: 16),
        ...schedules.map((schedule) => ScheduleTile(schedule: schedule)),
        if (schedules.isEmpty) EmptyState(message: emptyMessage),
      ],
    );
  }
}

class UsersList extends StatelessWidget {
  const UsersList({super.key, required this.users});

  final List<UserRow> users;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _HeroCard(
          title: 'Users',
          subtitle: 'Registered accounts and roles.',
          icon: Icons.people_alt_rounded,
        ),
        const SizedBox(height: 16),
        ...users.map(
          (user) => _Panel(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: Color(0xFFEFF6FF),
                child: Icon(Icons.person_rounded, color: Palette.blue),
              ),
              title: Text(
                user.name,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              subtitle: Text('${user.username}\n${user.roles.join(', ')}'),
              trailing: StatusChip(
                label: user.status,
                color: user.status == 'active'
                    ? Palette.success
                    : Palette.muted,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class ModuleSelection extends StatelessWidget {
  const ModuleSelection({
    super.key,
    required this.modules,
    required this.onSelect,
  });

  final List<ModuleOption> modules;
  final ValueChanged<ModuleOption> onSelect;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const _HeroCard(
          title: 'Select Module',
          subtitle: 'Choose the mobile workspace you want to open.',
          icon: Icons.apps_rounded,
        ),
        const SizedBox(height: 16),
        ...modules.map(
          (module) => _Panel(
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                backgroundColor: const Color(0xFFEFF6FF),
                child: Icon(module.icon, color: Palette.blue),
              ),
              title: Text(
                module.label,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              subtitle: const Text('Tap to continue'),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => onSelect(module),
            ),
          ),
        ),
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
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: .12),
          child: Icon(Icons.person_rounded, color: color),
        ),
        title: Text(
          faculty.name,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        subtitle: Text(
          [
            faculty.department,
            faculty.subject,
            if (showRoom && faculty.room.isNotEmpty) faculty.room,
            if (faculty.hasClass) '${faculty.startTime} - ${faculty.endTime}',
          ].where((item) => item.isNotEmpty).join('\n'),
        ),
        trailing: StatusChip(label: faculty.statusLabel, color: color),
        onTap: onTap,
      ),
    );
  }
}

class RoomTile extends StatelessWidget {
  const RoomTile({super.key, required this.room, required this.canManage});

  final RoomLocation room;
  final bool canManage;

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
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              backgroundColor: color.withValues(alpha: .12),
              child: Icon(Icons.meeting_room_rounded, color: color),
            ),
            title: Text(
              room.room,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            subtitle: Text(
              '${room.building}\n${room.floor}${room.occupants.isNotEmpty ? '\n${room.occupants.map((o) => o.name).join(', ')}' : ''}',
            ),
            trailing: StatusChip(label: room.status, color: color),
          ),
          if (canManage)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: ['Available', 'Reserved', 'Under Maintenance'].map((
                status,
              ) {
                return OutlinedButton(
                  onPressed: () => FirebaseDatabase.instance
                      .ref('rooms/${room.id}/room_status')
                      .set(status),
                  child: Text(
                    status == 'Under Maintenance' ? 'Maintenance' : status,
                  ),
                );
              }).toList(),
            ),
        ],
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
  const NotificationButton({
    super.key,
    required this.data,
    required this.userKey,
  });

  final AppData? data;
  final String userKey;

  @override
  State<NotificationButton> createState() => _NotificationButtonState();
}

class _NotificationButtonState extends State<NotificationButton> {
  String _read = '';

  String get _key {
    final update = widget.data?.lastScheduleUpdate;
    if (update == null) return '';
    return '${update['time']}|${update['import_batch_id']}|${update['deleted_import_batch_id']}';
  }

  @override
  Widget build(BuildContext context) {
    final unread = _key.isNotEmpty && _key != _read;
    return Stack(
      children: [
        IconButton(
          icon: const Icon(Icons.notifications_rounded),
          onPressed: () {
            setState(() => _read = _key);
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
                      'Notifications',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (widget.data?.lastScheduleUpdate == null)
                      const Text('No notifications yet.')
                    else
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const CircleAvatar(
                          child: Icon(Icons.event_note_rounded),
                        ),
                        title: Text(
                          widget.data!.lastScheduleUpdate!['deleted_import_batch_id'] !=
                                  null
                              ? 'Schedule upload removed'
                              : 'Schedule updated',
                        ),
                        subtitle: Text(
                          'Posted by ${widget.data!.lastScheduleUpdate!['name'] ?? 'System'}\n${widget.data!.lastScheduleUpdate!['time'] ?? ''}',
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
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
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Palette.navy, Palette.blue]),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Palette.blue.withValues(alpha: .16),
            blurRadius: 20,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: Colors.white.withValues(alpha: .16),
            child: Icon(icon, color: Colors.white),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFFEAF2FF),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({required this.stats});

  final List<Stat> stats;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: MediaQuery.of(context).size.width > 700 ? 4 : 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 1.35,
      children: stats
          .map(
            (stat) => _Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.circle, color: stat.color, size: 12),
                  const Spacer(),
                  Text(
                    stat.value,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    stat.label,
                    style: const TextStyle(
                      color: Palette.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    stat.detail,
                    style: const TextStyle(color: Palette.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.margin = EdgeInsets.zero});

  final Widget child;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Palette.border),
        borderRadius: BorderRadius.circular(18),
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
    return Container(
      height: 36,
      width: 58,
      decoration: BoxDecoration(
        color: Palette.yellow,
        borderRadius: BorderRadius.circular(4),
      ),
      alignment: Alignment.center,
      child: const Text(
        'STI',
        style: TextStyle(
          color: Palette.blue,
          fontSize: 22,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _LogoHeader extends StatelessWidget {
  const _LogoHeader();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        StiLogoSmall(),
        SizedBox(width: 12),
        Text(
          'STI Locator',
          style: TextStyle(
            fontSize: 22,
            color: Palette.text,
            fontWeight: FontWeight.w900,
          ),
        ),
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

class ModuleOption {
  const ModuleOption(this.id, this.label, this.icon, this.enabled);
  final String id;
  final String label;
  final IconData icon;
  final bool enabled;
}

class Stat {
  const Stat(this.label, this.value, this.detail, this.color);
  final String label;
  final String value;
  final String detail;
  final Color color;
}

Future<AppUser?> authenticateMobileUser(
  String login,
  String password,
  Map<String, dynamic> raw,
) async {
  if (login.toLowerCase() == 'admin@stilocator.local' &&
      password == 'Admin@12345') {
    return const AppUser(
      uid: 'admin',
      name: 'Admin',
      username: 'admin@stilocator.local',
      roleIds: ['admin'],
      userType: 'admin',
      permissions: {
        'access_admin_module': true,
        'access_faculty_module': true,
        'access_student_module': true,
      },
    );
  }

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
    if (storedPassword.isNotEmpty &&
        storedPassword != 'managed_by_firebase_auth' &&
        storedPassword != password) {
      continue;
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
