INSERT INTO "site_settings" ("setting_key", "setting_value", "description")
VALUES (
  'destination_widget',
  '{"enabled":false,"name":"Destination","country":"","latitude":0,"longitude":0,"placeId":"unconfigured","timezone":"UTC","temperatureUnit":"celsius"}',
  'Destination clock and weather widget configuration'
)
ON CONFLICT ("setting_key") DO NOTHING;
