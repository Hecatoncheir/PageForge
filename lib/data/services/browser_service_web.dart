import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';

@JS('pageForge.command')
external JSPromise<JSString> _command(JSString command, JSString arguments);

@JS('pageForge.chooseArchive')
external JSPromise<JSString> _chooseArchive(JSNumber tabId);

@JS('pageForge.subscribe')
external void _subscribe(JSFunction listener);

Map<String, Object?> _decode(JSString value) {
  final json = jsonDecode(value.toDart) as Map<String, Object?>;
  if (json['error'] case final String message) throw Exception(message);
  return json;
}

Future<Map<String, Object?>> execute(
  String command,
  Map<String, Object?> arguments,
) async {
  return _decode(
    await _command(command.toJS, jsonEncode(arguments).toJS).toDart,
  );
}

Future<Map<String, Object?>> chooseArchive(int tabId) async =>
    _decode(await _chooseArchive(tabId.toJS).toDart);

final _controller = StreamController<Map<String, Object?>>.broadcast();
bool _subscribed = false;
Stream<Map<String, Object?>> get events {
  if (!_subscribed) {
    _subscribe(
      ((JSString value) {
        _controller.add(jsonDecode(value.toDart) as Map<String, Object?>);
      }).toJS,
    );
    _subscribed = true;
  }
  return _controller.stream;
}
