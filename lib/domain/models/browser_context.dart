import 'appearance.dart';
import 'release_info.dart';

class BrowserContext {
  const BrowserContext({
    required this.siteLabel,
    required this.version,
    this.tabId = -1,
    this.supported = false,
    this.isExtension = false,
    this.originPattern,
    this.selectedId,
    this.theme = 'dark',
    this.appearances = const [],
    this.allAppearances = const [],
    this.appUpdate,
  });

  final String siteLabel;
  final String version;
  final int tabId;
  final bool supported;
  final bool isExtension;
  final String? originPattern;
  final String? selectedId;
  final String theme;
  final List<Appearance> appearances;
  final List<Appearance> allAppearances;
  final ReleaseInfo? appUpdate;

  factory BrowserContext.fromJson(Map<String, Object?> json) {
    final library = [
      for (final item in json['library'] as List<Object?>? ?? [])
        Appearance.fromJson(item as Map<String, Object?>),
    ];
    final byId = {for (final appearance in library) appearance.id: appearance};
    return BrowserContext(
      siteLabel: json['siteLabel'] as String,
      version: json['version'] as String,
      tabId: json['tabId'] as int? ?? -1,
      supported: json['supported'] as bool? ?? false,
      isExtension: json['extension'] as bool? ?? false,
      originPattern: json['originPattern'] as String?,
      selectedId: json['selectedId'] as String?,
      theme: json['theme'] as String? ?? 'dark',
      appUpdate: json['appUpdate'] == null
          ? null
          : ReleaseInfo.fromJson(json['appUpdate'] as Map<String, Object?>),
      appearances: [
        for (final item in json['profiles'] as List<Object?>? ?? [])
          byId[(item as Map<String, Object?>)['id']] ??
              Appearance.fromJson(item),
      ],
      allAppearances: library,
    );
  }
}
