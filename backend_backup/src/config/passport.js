const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const env = require('./env');
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

passport.use(new SteamStrategy({
    returnURL: `${env.serverUrl}/api/auth/steam/return`,
    realm: env.serverUrl,
    apiKey: env.steamApiKey,
    passReqToCallback: true
  },
  async (req, identifier, profile, done) => {
    try {
      // O identifier é algo como http://steamcommunity.com/openid/id/76561198089176770
      const steamId = identifier.split('/').pop();
      
      // Se o utilizador já estiver logado (via JWT), queremos "vincular" a conta
      // No entanto, o passport-steam usa sessões. Precisamos de uma ponte.
      
      // Procurar utilizador por steamId
      let user = await User.findOne({ 'externalApis.steam.steamId': steamId });
      
      if (user) {
        return done(null, user);
      }

      // Se não existe utilizador com este SteamID, podemos criar um ou 
      // retornar erro se for apenas para vínculo. 
      // Por agora, vamos retornar o perfil para o controlador decidir.
      return done(null, { steamId, profile });
    } catch (err) {
      return done(err);
    }
  }
));

module.exports = passport;
