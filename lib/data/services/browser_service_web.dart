import 'dart:convert';
import 'dart:js_interop';

import '../../domain/models/browser_context.dart';

@JS('pageForge.getContext')
external JSPromise<JSString> _getContext();

Future<BrowserContext> readBrowserContext() async {
  final result = await _getContext().toDart;
  final json = jsonDecode(result.toDart) as Map<String, Object?>;
  return BrowserContext.fromJson(json);
}
