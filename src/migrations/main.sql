CREATE TABLE IF NOT EXISTS "Packages"(
    "PackageId" integer not null generated by default as identity,
    "PackageName" varchar(300) not null,
    "PackageVersion" varchar(50) not null,
    "PathToArchive" varchar(500) not null,
    "Created" timestamp default current_timestamp,
    constraint "Packages_PackageId" primary key("PackageId")
);