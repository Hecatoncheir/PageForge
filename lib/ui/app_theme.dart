import 'package:flutter/material.dart';

ThemeData pageForgeTheme(bool light) {
  Color choose(int lightValue, int darkValue) =>
      Color(light ? lightValue : darkValue);
  final background = choose(0xFFF2E5BC, 0xFF32302F);
  final ink = choose(0xFF282828, 0xFFFBF1C7);
  final colors =
      ColorScheme.fromSeed(
        seedColor: const Color(0xFFFE8019),
        brightness: light ? Brightness.light : Brightness.dark,
      ).copyWith(
        primary: choose(0xFFAF3A03, 0xFFFE8019),
        onPrimary: choose(0xFFFBF1C7, 0xFF282828),
        surface: background,
        onSurface: ink,
        onSurfaceVariant: choose(0xFF665C54, 0xFFBDAE93),
        surfaceContainerHighest: choose(0xFFEBDBB2, 0xFF3C3836),
        surfaceContainerLow: choose(0xFFFBF1C7, 0xFF282828),
        outline: choose(0xFFD5C4A1, 0xFF504945),
        outlineVariant: choose(0xFFD5C4A1, 0xFF504945),
        error: choose(0xFF9D0006, 0xFFFB4934),
      );
  return ThemeData(
    useMaterial3: true,
    fontFamily: 'NunitoSans',
    scaffoldBackgroundColor: background,
    colorScheme: colors,
    textTheme: ThemeData(brightness: colors.brightness).textTheme
        .apply(fontFamily: 'NunitoSans', bodyColor: ink, displayColor: ink),
    splashFactory: InkSparkle.splashFactory,
  );
}
