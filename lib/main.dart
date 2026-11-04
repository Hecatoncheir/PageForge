import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import 'data/repositories/browser_repository.dart';
import 'ui/home/home_screen.dart';
import 'ui/home/home_view_model.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SemanticsBinding.instance.ensureSemantics();
  runApp(PageForgeApp(repository: BrowserRepository()));
}

class PageForgeApp extends StatefulWidget {
  const PageForgeApp({super.key, required this.repository});

  final BrowserRepository repository;

  @override
  State<PageForgeApp> createState() => _PageForgeAppState();
}

class _PageForgeAppState extends State<PageForgeApp> {
  late final HomeViewModel _model;

  @override
  void initState() {
    super.initState();
    _model = HomeViewModel(widget.repository)..load(refreshPreview: true);
  }

  @override
  void dispose() {
    _model.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _model,
      builder: (context, _) {
        final light = _model.lightTheme;
        final background = Color(light ? 0xFFF2E5BC : 0xFF32302F);
        final ink = Color(light ? 0xFF282828 : 0xFFFBF1C7);
        final colors =
            ColorScheme.fromSeed(
              seedColor: const Color(0xFFFE8019),
              brightness: light ? Brightness.light : Brightness.dark,
            ).copyWith(
              primary: Color(light ? 0xFFAF3A03 : 0xFFFE8019),
              onPrimary: Color(light ? 0xFFFBF1C7 : 0xFF282828),
              surface: background,
              onSurface: ink,
              onSurfaceVariant: Color(light ? 0xFF665C54 : 0xFFBDAE93),
              surfaceContainerHighest: Color(light ? 0xFFEBDBB2 : 0xFF3C3836),
              surfaceContainerLow: Color(light ? 0xFFFBF1C7 : 0xFF282828),
              outline: Color(light ? 0xFFD5C4A1 : 0xFF504945),
              outlineVariant: Color(light ? 0xFFD5C4A1 : 0xFF504945),
              error: Color(light ? 0xFF9D0006 : 0xFFFB4934),
            );
        return MaterialApp(
          title: 'PageForge',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            fontFamily: 'NunitoSans',
            scaffoldBackgroundColor: background,
            colorScheme: colors,
            textTheme: ThemeData(brightness: colors.brightness).textTheme.apply(
              fontFamily: 'NunitoSans',
              bodyColor: ink,
              displayColor: ink,
            ),
            splashFactory: InkSparkle.splashFactory,
          ),
          home: HomeScreen(model: _model),
        );
      },
    );
  }
}
