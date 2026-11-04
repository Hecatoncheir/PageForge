import 'package:flutter/material.dart';

import '../../../domain/models/appearance.dart';

class AppearancePreview extends StatelessWidget {
  const AppearancePreview({
    super.key,
    required this.appearance,
    required this.height,
  });
  final Appearance appearance;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: appearance.preview == null
            ? ColoredBox(
                color: colors.surfaceContainerHighest,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.web_outlined,
                      size: height < 80 ? 20 : 25,
                      color: colors.onSurfaceVariant,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      appearance.previewState == 'capturing'
                          ? 'Готовим превью…'
                          : height < 80
                          ? 'Откройте сайт'
                          : 'Превью при открытии сайта',
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 8,
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              )
            : Image.memory(
                appearance.preview!,
                fit: BoxFit.cover,
                alignment: Alignment.topCenter,
                gaplessPlayback: true,
              ),
      ),
    );
  }
}
