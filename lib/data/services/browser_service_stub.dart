Future<Map<String, Object?>> execute(
  String command,
  Map<String, Object?> arguments,
) async => {
  'siteLabel': 'Предпросмотр интерфейса',
  'version': const String.fromEnvironment(
    'PAGEFORGE_VERSION',
    defaultValue: '0.1.0',
  ),
};

Future<Map<String, Object?>> chooseArchive(int tabId) async => {
  'cancelled': true,
};

const events = Stream<Map<String, Object?>>.empty();
