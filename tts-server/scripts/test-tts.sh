#!/bin/bash
printf '%s' '{"text":"Hej, jag heter Alma."}' > /tmp/tts.json
curl -s -X POST http://127.0.0.1:3001/api/tts -H "Content-Type: application/json" --data-binary @/tmp/tts.json -o /tmp/test.wav -w "HTTP:%{http_code} size:%{size_download}\n"
ls -la /tmp/test.wav
