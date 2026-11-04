import 'appearance.dart';

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

  factory BrowserContext.fromJson(Map<String, Object?> json) {
    return BrowserContext(
      siteLabel: json['siteLabel'] as String,
      version: json['version'] as String,
      tabId: json['tabId'] as int? ?? -1,
      supported: json['supported'] as bool? ?? false,
      isExtension: json['extension'] as bool? ?? false,
      originPattern: json['originPattern'] as String?,
      selectedId: json['selectedId'] as String?,
      theme: json['theme'] as String? ?? 'dark',
      appearances: [
        for (final item in json['profiles'] as List<Object?>? ?? [])
          Appearance.fromJson(item as Map<String, Object?>),
      ],
      allAppearances: [
        for (final item in json['library'] as List<Object?>? ?? [])
          Appearance.fromJson(item as Map<String, Object?>),
      ],
    );
  }
}
