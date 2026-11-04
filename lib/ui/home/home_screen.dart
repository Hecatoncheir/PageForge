import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'home_cubit.dart';
import 'home_state.dart';
import 'widgets/appearance_panel.dart';
import 'widgets/development_panel.dart';
import 'widgets/home_footer.dart';
import 'widgets/home_header.dart';
import 'widgets/library_panel.dart';
import 'widgets/mode_selector.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  void _showNotice(BuildContext context, HomeState state) {
    if (state.message == null) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(state.message!),
          duration: const Duration(seconds: 3),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  @override
  Widget build(BuildContext context) => BlocConsumer<HomeCubit, HomeState>(
    listenWhen: (previous, current) => previous.messageId != current.messageId,
    listener: _showNotice,
    builder: (context, state) {
      final cubit = context.read<HomeCubit>();
      return Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ModeSelector(value: state.tab, onChanged: cubit.navigate),
              HomeHeader(state: state),
              SizedBox(
                height: 2,
                child: state.busy
                    ? const LinearProgressIndicator(minHeight: 2)
                    : null,
              ),
              const SizedBox(height: 6),
              Expanded(
                child: AnimatedSwitcher(
                  duration: MediaQuery.disableAnimationsOf(context)
                      ? Duration.zero
                      : const Duration(milliseconds: 220),
                  switchInCurve: Curves.easeOutCubic,
                  child: _content(state, cubit),
                ),
              ),
              const SizedBox(height: 12),
              Divider(height: 1, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 12),
              HomeFooter(state: state, cubit: cubit),
            ],
          ),
        ),
      );
    },
  );

  Widget _content(HomeState state, HomeCubit cubit) => switch (state.page) {
    HomePage.appearance => AppearancePanel(
      key: const ValueKey(HomePage.appearance),
      state: state,
      cubit: cubit,
    ),
    HomePage.development => DevelopmentPanel(
      key: const ValueKey(HomePage.development),
      state: state,
      cubit: cubit,
    ),
    HomePage.library => LibraryPanel(
      key: const ValueKey(HomePage.library),
      state: state,
      cubit: cubit,
      onBack: () => cubit.navigate(HomePage.appearance),
    ),
  };
}
