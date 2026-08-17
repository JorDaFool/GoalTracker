/// <reference path="../pb_data/types.d.ts" />

// One record per user, holding their goals + history as JSON blobs —
// mirrors the two localStorage keys the app used before sync existed.
migrate((app) => {
  const collection = new Collection({
    name: 'goal_data',
    type: 'base',
    fields: [
      {
        name: 'owner',
        type: 'relation',
        required: true,
        collectionId: '_pb_users_auth_',
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: 'goals',
        type: 'json',
      },
      {
        name: 'history',
        type: 'json',
      },
    ],
    listRule: 'owner = @request.auth.id',
    viewRule: 'owner = @request.auth.id',
    createRule: '@request.auth.id != ""',
    updateRule: 'owner = @request.auth.id',
    deleteRule: 'owner = @request.auth.id',
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('goal_data');
  return app.delete(collection);
});
