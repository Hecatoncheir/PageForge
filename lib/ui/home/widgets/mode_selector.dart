import 'package:flutter/material.dart';

import '../home_state.dart';
import '../../widgets/cupertino/sliding_segmented_control.dart';

class ModeSelector extends StatelessWidget {
  const ModeSelector({super.key, required this.value, required this.onChanged});

  final HomePage value;
  final ValueChanged<HomePage> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    const labels = {
      HomePage.appearance: 'Отображение',
      HomePage.development: 'Разработка',
    };
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.surfaceContainerLow,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: colors.outline),
          borderRadius: BorderRadius.circular(10),
        ),
      ),
      child: PageForgeSlidingSegmentedControl<HomePage>(
        groupValue: value,
        backgroundColor: Colors.transparent,
        thumbColor: colors.surfaceContainerHighest,
        showThumbShadow: Theme.of(context).brightness == Brightness.dark,
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
        onValueChanged: (selected) {
          if (selected != null) onChanged(selected);
        },
        children: {
          for (final entry in labels.entries)
            entry.key: SizedBox(
              height: 34,
              child: Center(
                child: Text(
                  entry.value,
                  style: TextStyle(
                    fontFamily: 'NunitoSans',
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: value == entry.key
                        ? colors.onSurface
                        : colors.onSurfaceVariant,
                  ),
                ),
              ),
            ),
        },
      ),
    );
  }
}
