'use strict';

/** 
 * Helpers
*/
async function checkIfAuthorized(accessRight, owner, currentParticipant){
    // get specific AuthorizationBlock
    let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
    let authorizationBlock = await authorizationBlockRegistry.get(owner.getIdentifier());

    // Check if the careprovider is authorized to create
    let authorizedProviders = authorizationBlock.authorization;
    var providerIsAuthorized = false;

    authorizedProviders.forEach((element) => {
        if (element.careProviderId == currentParticipant.email &&
            element.accessRights.includes(accessRight)) {
                providerIsAuthorized = true;
        }
    })

    return providerIsAuthorized
}


async function checkAccessRights(authBlock, careProviderId, accessRight) {
    var authorized = false;
  	var accessRights;
    
    authBlock.authorization.forEach((element, index) => {
        if (element.careProviderId == careProviderId){
            if(element.accessRights.includes(accessRight)) {
                authorized = true;
                accessRights = element.accessRights;
            }
        }
    })

    return [authorized, accessRights];
}


async function getAuthIndex(authorizationBlock, careProviderId) {
    var authIndex = -1
  authorizationBlock.authorization.forEach((element, index) => {
      if (element.careProviderId == careProviderId){
        console.log(element.careProviderId, ' ', careProviderId, ' ', index)
        authIndex = index;
      }
  })

  return authIndex;
}