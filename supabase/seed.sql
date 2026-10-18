-- Configuration data only. Demo requests are intentionally not shipped; create them through the UI.
insert into departments (name, description) values
 ('Roads and Transport','Roads, potholes, signage'),('Water Services','Supply and leakages'),
 ('Waste Management','Garbage collection'),('Public Lighting','Streetlights'),
 ('Public Health','Sanitation and drainage'),('General Services','Everything else');
insert into request_categories (name, default_department_id)
 select c.n, d.id from (values ('Roads and Transport','Roads and Transport'),('Water and Drainage','Water Services'),
 ('Waste Management','Waste Management'),('Street Lighting','Public Lighting'),
 ('Public Health and Sanitation','Public Health'),('Other Public Services','General Services')) c(n, dn)
 join departments d on d.name = c.dn;
