import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import 'data/repositories/browser_repository.dart';
import 'ui/home/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SemanticsBinding.instance.ensureSemantics();
  runApp(PageForgeApp(repository: BrowserRepository()));
}

class PageForgeApp extends StatelessWidget {
  const PageForgeApp({super.key, required this.repository});

  final BrowserRepository repository;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PageForge',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Roboto',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF7255D8),
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF17171D),
      ),
      home: HomeScreen(repository: repository),
    );
  }
}
