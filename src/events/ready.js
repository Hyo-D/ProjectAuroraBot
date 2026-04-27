module.exports = {
    name: 'clientReady',
    once: true, 
    execute(client) {
        console.log(`🚂 Project Aurora encendido!`);

        const servers = client.guilds.cache;
        
        console.log(`\n==================================================`);
        console.log(`📊 Project Aurora está activo en ${servers.size} servidores:`);
        console.log(`==================================================`);
        
        servers.forEach(guild => {
            console.log(` └ 📌 ${guild.name} (👥 ${guild.memberCount} miembros)`);
        });
        
        console.log(`==================================================\n`);
    },
};