import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'data/repositories/browser_repository.dart';
import 'ui/app_theme.dart';
import 'ui/home/home_cubit.dart';
import 'ui/home/home_screen.dart';
import 'ui/home/home_state.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SemanticsBinding.instance.ensureSemantics();
  runApp(PageForgeApp(repository: BrowserRepository()));
}

class PageForgeApp extends StatelessWidget {
  const PageForgeApp({super.key, required this.repository});
  final BrowserRepository repository;

  @override
  Widget build(BuildContext context) => BlocProvider(
    create: (_) => HomeCubit(repository)..load(refreshPreview: true),
    child: BlocSelector<HomeCubit, HomeState, bool>(
      selector: (state) => state.lightTheme,
      builder: (context, light) => MaterialApp(
        title: 'PageForge',
        debugShowCheckedModeBanner: false,
        theme: pageForgeTheme(light),
        home: const HomeScreen(),
      ),
    ),
  );
}
