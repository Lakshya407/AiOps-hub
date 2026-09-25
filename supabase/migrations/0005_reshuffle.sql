-- Curriculum reshuffle: Python->Month1, drop Full-stack, Logging->Elastic Stack, fix months/orders.
-- Safe to run multiple times.
delete from public.skills where title = 'Full-Stack';
update public.skills set title='Elastic Stack', description='Elasticsearch, Logstash, Kibana and Beats for search and observability. Now: Basic/working -> Target: Intermediate.', sort_order=14, estimated_hours=12, phase_id='6ac9ce83-e736-501b-9f02-c45fa724d0a8' where id='ad27432e-17ac-5149-98db-0aa6254951f2';
delete from public.topics where skill_id='ad27432e-17ac-5149-98db-0aa6254951f2' and title not in ('Elasticsearch', 'Filebeat', 'Kibana');
update public.skills set sort_order=1, estimated_hours=20, phase_id='d230f0e0-82e5-5ed8-8cab-3e9bf211a8e2' where id='f0415d2d-46ad-57e4-9714-9819f9754c36';
update public.skills set sort_order=2, estimated_hours=16, phase_id='d230f0e0-82e5-5ed8-8cab-3e9bf211a8e2' where id='a280b0f4-adbe-53a8-85b9-9e160b42f237';
update public.skills set sort_order=3, estimated_hours=12, phase_id='d230f0e0-82e5-5ed8-8cab-3e9bf211a8e2' where id='01e9b8d6-10fb-e3c0-6b38-92ce68f0c361';
update public.skills set sort_order=4, estimated_hours=18, phase_id='d230f0e0-82e5-5ed8-8cab-3e9bf211a8e2' where id='19b8e145-8102-5aef-be39-8b0aaf5f86d0';
update public.skills set sort_order=5, estimated_hours=10, phase_id='87d199a6-bcd1-52df-b684-1447658416a9' where id='e6552526-8d85-15d8-c5b9-9d70af5ead9c';
update public.skills set sort_order=6, estimated_hours=12, phase_id='87d199a6-bcd1-52df-b684-1447658416a9' where id='9424ac84-a7a1-5913-a9ca-dcbaffa72e09';
update public.skills set sort_order=7, estimated_hours=24, phase_id='87d199a6-bcd1-52df-b684-1447658416a9' where id='1d4bfb28-9a54-5d1c-807e-a8ee0e96efba';
update public.skills set sort_order=8, estimated_hours=20, phase_id='803b8395-df74-5389-804f-57721fcd20c4' where id='50e14550-a500-5a81-a705-b1c0559807d8';
update public.skills set sort_order=9, estimated_hours=14, phase_id='803b8395-df74-5389-804f-57721fcd20c4' where id='da3c3707-33bc-5625-a60b-ba0eb54bcec4';
update public.skills set sort_order=10, estimated_hours=12, phase_id='803b8395-df74-5389-804f-57721fcd20c4' where id='3e056343-3a91-5908-b460-f489982a942e';
update public.skills set sort_order=11, estimated_hours=10, phase_id='6ac9ce83-e736-501b-9f02-c45fa724d0a8' where id='cb45de0c-3506-1672-b339-94ad0ee23096';
update public.skills set sort_order=12, estimated_hours=12, phase_id='6ac9ce83-e736-501b-9f02-c45fa724d0a8' where id='b0174deb-f898-545a-b1af-94aa8d4f6cba';
update public.skills set sort_order=13, estimated_hours=8, phase_id='6ac9ce83-e736-501b-9f02-c45fa724d0a8' where id='9472d731-61cf-5fc2-97c1-b2ad5f3455ca';
update public.skills set sort_order=15, estimated_hours=10, phase_id='86820ba4-b109-5961-8209-3ba504f479f8' where id='15735516-ff38-5269-ab0d-0a0e59db04de';
update public.skills set sort_order=16, estimated_hours=10, phase_id='86820ba4-b109-5961-8209-3ba504f479f8' where id='ec83d0fe-ea7b-5087-b9d9-07866c85da7c';
update public.skills set sort_order=17, estimated_hours=14, phase_id='86820ba4-b109-5961-8209-3ba504f479f8' where id='a77dc65a-b9e7-51b1-808f-25f08d42ecf5';
update public.skills set sort_order=18, estimated_hours=16, phase_id='a6d0b080-9bb6-52f8-af78-5013e6c04dcd' where id='4a759357-e4ea-a58b-7e4b-2ffb79c165cb';
