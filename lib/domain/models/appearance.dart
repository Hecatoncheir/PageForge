import 'dart:convert';
import 'dart:typed_data';

class Appearance {
  const Appearance({
    required this.id,
    required this.name,
    required this.version,
    this.preview,
    this.previewState = 'pending',
    this.siteLabel = '',
    this.compatible = true,
  });

  final String id;
  final String name;
  final String version;
  final Uint8List? preview;
  final String previewState;
  final String siteLabel;
  final bool compatible;

  factory Appearance.fromJson(Map<String, Object?> json) {
    final data = json['preview'] as String?;
    return Appearance(
      id: json['id'] as String,
      name: json['name'] as String,
      version: json['version'] as String,
      preview: data == null ? null : base64Decode(data.split(',').last),
      previewState: json['previewState'] as String? ?? 'pending',
      siteLabel: json['siteLabel'] as String? ?? '',
      compatible: json['compatible'] as bool? ?? true,
    );
  }
}
