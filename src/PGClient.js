import pg from 'pg';
import fs from 'fs';

export default class PGClient{
    constructor(){
        this.client = new pg.Client({
            host: process.env.PG_HOST ?? 'localhost',
            port: process.env.PG_PORT ?? 5432,
            database: process.env.PG_DATABASE ?? 'postgres',
            password: process.env.PG_PASSWORD ?? 'postgres',
            user: process.env.PG_USER ?? 'postgres'
        });

        this.client.connect();
    }

    upMigration(){
        let query = fs.readFileSync(`${process.cwd()}/src/migrations/main.sql`);
        this.client.query(query.toString(), (err, res) => {
            if(err)
                throw new Error(err);
        });
    }

    async profileExist(profileData){
        let { rows } = await this.client.query(
            `select * from "Profiles" where "ProfileName" = $1`, 
            [profileData.ProfileName]
        );

        return rows.length > 0;
    }

    async isProfileOwner(profileData){
        let { rows } = await this.client.query(
            `select * from "Profiles" where "ProfileName" = $1 and "ProfileSignature" = $2`, 
            [profileData.ProfileName, profileData.Signature]
        );

        return rows.length > 0;
    }

    async createProfile(profileData){
        await this.client.query(
            `insert into "Profiles" ("ProfileName", "ProfileSignature") VALUES ($1, $2)`, 
            [profileData.ProfileName, profileData.Signature]
        )
    }

    async registerPackage(data){
        let { rows } = await this.client.query(
            `select * from "Packages" where "PackageName" = $1 and "PackageVersion" = $2`, 
            [data.PackageName, data.PackageVersion]
        );

        if(rows.length > 0){
            rows.forEach(row => {
                this.client.query(`delete from "Packages" where "PackageId" = $1`, [row.PackageId]);
            });
        }

        return (await this.client.query(
            `insert into "Packages" ("PackageName", "PackageVersion", "PathToArchive", "IsPublic", "PackageReferences") VALUES ($1, $2, $3, $4, $5) RETURNING "PackageId"`,
            [data.PackageName, data.PackageVersion, data.PathToArchive, data.IsPublic, data.PackageReferences]
        )).rows[0].PackageId;
    }

    async removePackage(name){
        let { rows } = await this.client.query(
            `select * from "Packages" where "PackageName" = $1`, 
            [name]
        );

        if(rows.length > 0){
            rows.forEach(async row => {
                await this.client.query('delete from "Packages" where "PackageId" = $1', [row.PackageId]);
            });
        }
    }

    async removePackageVersion(name, version){
        let { rows } = await this.client.query(
            `select * from "Packages" where "PackageName" = $1 and "PackageVersion" = $2`, 
            [name, version]
        );

        if(rows.length > 0){
            rows.forEach(async row => {
                await this.client.query('delete from "Packages" where "PackageId" = $1', [row.PackageId]);
            });
        }
    }

    async getPackage(id){
        return await this.client.query(
            'select * from "Packages" where "PackageId" = $1',
            [id]
        );
    }

    async addDownload(id){
        this.client.query(
            'update"Packages" set "Downloads" = "Downloads" + 1 where "PackageId" = $1',
            [id]
        );
    }

    async findPackage(PackageName = null, PackageVersion = null){
        let filter = {
            PackageName,
            PackageVersion
        }

        let where = [];
        let parameters = [];
        let findex = 1;

        for(let key in filter){
            if(filter[key]){
                switch(key){
                    case 'PackageVersion':
                        where.push(`"${key}" like $${findex++}`);
                        parameters.push(filter[key].replace(/\*/g, '%'));
                        break;
                    default:
                        where.push(`"${key}" = $${findex++}`);
                        parameters.push(filter[key]);
                }
            }  
        }

        return await this.client.query(
            `select "PackageId", "PackageName", "PackageVersion", "Created", "Downloads", "PackageReferences" from "Packages"`
            + (where.length > 0 ? ` where ${where.join(' and ')}` : '') + ' order by "PackageVersion" desc limit 100',
            parameters
        );
    }

    async getPackages(page = 1, limit = 1000){
        let offset = (page - 1) * limit;
        return await this.client.query(
            `select "PackageId", "PackageName", "PackageVersion", "IsPublic", "Created", "Downloads", "PackageReferences" from "Packages" offset $1 limit $2`,
            [offset, limit]
        );
    }

    async getTotal(){
        return (await this.client.query(
            `select count(*) as total from "Packages"`
        )).rows[0].total;
    }
}