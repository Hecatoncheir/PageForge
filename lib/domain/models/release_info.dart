class ReleaseInfo {
  const ReleaseInfo({
    this.version,
    this.url,
    this.error,
    this.available = false,
  });

  final String? version;
  final String? url;
  final String? error;
  final bool available;

  factory ReleaseInfo.fromJson(Map<String, Object?> json) => ReleaseInfo(
    version: json['version'] as String?,
    url: json['url'] as String?,
    error: json['error'] as String?,
    available: json['available'] as bool? ?? false,
  );

  String get label {
    if (error != null) return 'Проверка недоступна';
    if (available) return 'Новая версия $version';
    if (version == null) return 'Релизов пока нет';
    return 'Новых версий нет';
  }
}
