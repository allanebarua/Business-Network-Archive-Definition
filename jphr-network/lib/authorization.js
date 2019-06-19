'use strict';
const NetworkNamespace = 'org.jphr.network';

/**
 * Transaction processor function.
 * @param {org.jphr.network.ManageAuthorization} trans create transaction instance.
 * @transaction
 */
async function ManageAuthorization(trans) {
    let action = trans.action;

    try {
        /* Creating Authorization block */
        if(action == 'Create') {
            var owner = getCurrentParticipant();

            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.exists(owner.getIdentifier());

            if(authorizationBlock){
                throw 'Exists'
            }

            let newAuthorizationBlock = getFactory().newResource(NetworkNamespace, 'AuthorizationBlock', owner.getIdentifier());
            newAuthorizationBlock.owner = owner;
            newAuthorizationBlock.authorization = trans.authBlock.authorization;

            await authorizationBlockRegistry.add(newAuthorizationBlock);
            return 'success'
        }

        /* Grant Access */
        else if (action == 'Grant') {
            let authBlock = trans.authBlock;
            let grantee = trans.authBlock.authorization[0].careProviderId;
            let owner = getCurrentParticipant();


            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.get(owner.getIdentifier());

            // check if the careprovider is already authorized
            let authIndex = await getAuthIndex(authorizationBlock, grantee)

            if (authIndex != -1){
                authorizationBlock.authorization[authIndex].accessRights = trans.authBlock.authorization[0].accessRights;
                await authorizationBlockRegistry.update(authorizationBlock);
                return 'success'
            }

            authBlock.authorization[0].careProviderId = grantee
            authorizationBlock.authorization.push(authBlock.authorization[0])

            await authorizationBlockRegistry.update(authorizationBlock);
            return 'success'

        }

        /* Revoke Access */
        else if (action == 'Revoke') {
            let owner = getCurrentParticipant();

            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.get(owner.getIdentifier());

            let revokedAuthorization = trans.authBlock.authorization[0].careProviderId;

            let revokeIndex =await getAuthIndex(authorizationBlock, revokedAuthorization);

            if (revokeIndex == -1){
                throw 'Not Found'
            }

            authorizationBlock.authorization.splice(revokeIndex, 1)

            await authorizationBlockRegistry.update(authorizationBlock);
            return 'success'
        }

        /* Update Access rights */
        else if (action == 'UpdateAccessRights') {
            let owner = getCurrentParticipant();

            let authorizationBlockRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
            let authorizationBlock = await authorizationBlockRegistry.get(owner.getIdentifier());

            let revokedAuthorization = trans.authBlock.authorization[0].careProviderId
            console.log(revokedAuthorization)
            let authIndex =await getAuthIndex(authorizationBlock, revokedAuthorization);

            if (authIndex == -1){
                throw 'Not Found'
            }
          console.log(authIndex, ' ' , authorizationBlock.authorization[authIndex])

            authorizationBlock.authorization[authIndex].accessRights = trans.authBlock.authorization[0].accessRights;
            await authorizationBlockRegistry.update(authorizationBlock);
            return 'success'
        }

    }
    catch(err){
      console.log(err);
      return err;
    }
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.ReadAuthorizations} trans create transaction instance.
 * @transaction
 */
async function ReadAuthorizations(trans) {
    // get all health records
    let authorizationRegistry  = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
    const allRecords = await authorizationRegistry.getAll();
    let careProvider= getCurrentParticipant().getIdentifier();
    var relevantRecords = []
    
    if (getCurrentParticipant().getFullyQualifiedType() == `${NetworkNamespace}.Patient`) {
        console.log(allRecords)
        return allRecords;
    }

    // Return only records that contain the careprovider's id in the authorizations.
    else {
        for (let authData of allRecords) {
            let mydata = await checkIfProviderIsAuthorized(careProvider ,authData);

            if (mydata) {
                relevantRecords.push(mydata);
            }
        }
    }

    return relevantRecords
}


async function checkIfProviderIsAuthorized(providerId, authorizationBlock) {
    var found = false;
    // check if the careprovider is authorized
    for(auth of authorizationBlock.authorization) {
        if (auth.careProviderId == providerId) {
            authorizationBlock.authorization = [auth];
            found = true;
            break;
        }
    }

    if(found) {
        return authorizationBlock;
    }
    return;
}