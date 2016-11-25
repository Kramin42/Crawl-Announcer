'use strict';
module.exports = function(sequelize, DataTypes) {
  var Channel = sequelize.define('Channel', {
    name: DataTypes.STRING,
    relay_enabled: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Channel;
};