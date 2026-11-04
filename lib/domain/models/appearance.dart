import 'dart:convert';
import 'dart:typed_data';

import 'release_info.dart';

class Appearance {
  const Appearance({
    required this.id,
    required this.name,
    required this.version,
    this.preview,
    this.previewState = 'pending',
    this.siteLabel = '',
    this.compatible = true,
    this.repositoryUrl,
    this.update,
    this.selected = false,
  });

  final String id;
  final String name;
  final String version;
  final Uint8List? preview;
  final String previewState;
  final String siteLabel;
  final bool compatible;
  final String? repositoryUrl;
  final ReleaseInfo? update;
  final bool selected;

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
      repositoryUrl: json['repositoryUrl'] as String?,
      selected: json['selected'] as bool? ?? false,
      update: json['update'] == null
          ? null
          : ReleaseInfo.fromJson(json['update'] as Map<String, Object?>),
    );
  }
}
