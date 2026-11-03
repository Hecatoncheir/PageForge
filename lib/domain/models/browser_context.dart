class BrowserContext {
  const BrowserContext({required this.siteLabel, required this.version});

  final String siteLabel;
  final String version;

  factory BrowserContext.fromJson(Map<String, Object?> json) {
    return BrowserContext(
      siteLabel: json['siteLabel'] as String,
      version: json['version'] as String,
    );
  }
}
