'use strict';

/**
 * schliessplan-system-option router
 *
 * Public read access is needed because the frontend loads these display options
 * before a user is authenticated. Mutations stay behind Strapi permissions.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::schliessplan-system-option.schliessplan-system-option', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});