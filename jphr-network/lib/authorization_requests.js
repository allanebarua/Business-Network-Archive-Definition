'use strict';

/**
 * Transaction processor function.
 * @param {org.jphr.network.CreateAuthRequest} trans create transaction instance.
 * @transaction
 */
async function CreateAuthRequest(trans) {

    try {
        // Data to be stored
        var authRequest = trans.authRequest;

        // Check that the participant is either a patient or careProvider
        var createdBy = getCurrentParticipant();
        
        // Get asset registry
        let assetRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationRequest`);
        let newAuthRequest = getFactory().newResource(NetworkNamespace, 'AuthorizationRequest', authRequest.requestId);

        newAuthRequest.patient = authRequest.patient;
        newAuthRequest.provider = createdBy.getIdentifier();
        newAuthRequest.accessRights = authRequest.accessRights;
        newAuthRequest.reason = authRequest.reason;
        newAuthRequest.type = authRequest.type;
        newAuthRequest.state = authRequest.state;

        await assetRegistry.add(newAuthRequest);
        return 'success';
    }

    catch (err) {
        return err;
    }   
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.UpdateAuthRequest} trans create transaction instance.
 * @transaction
 */
async function UpdateAuthRequest(trans) {
    try {
        // get specific HealthRecord
        let authRequestRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationRequest`);
        let previousAuthRequest = await authRequestRegistry.get(trans.authRequest.requestId);
        console.log(previousAuthRequest)

        previousAuthRequest.state = trans.authRequest.state;
        await authRequestRegistry.update(previousAuthRequest);
        return 'success';
    }

    catch (err) {
        return err;
    }
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.DeleteAuthRequest} trans Health Record id.
 * @transaction
 */
async function DeleteAuthRequest(trans) {
    try {
        // get Health Record, Check Authorization, Delete if necessary
        let authRequestRegistry  = await getAssetRegistry(`${NetworkNamespace}.AuthorizationRequest`);
        let authRequest = await authRequestRegistry.get(trans.requestId);
        await authRequestRegistry.remove(authRequest);
        return 'success';
    }

    catch (err) {
        return err;
    }
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.ReadAuthRequests} trans create transaction instance.
 * @transaction
 */
async function ReadAuthRequests(trans) {
    // get all health records
    let authRequestRegistry  = await getAssetRegistry(`${NetworkNamespace}.AuthorizationRequest`);
    let allRecords = await authRequestRegistry.getAll();
    let currentParticipant = getCurrentParticipant().getIdentifier();
    var relevantRecords = []
    
    if (getCurrentParticipant().getFullyQualifiedType() == `${NetworkNamespace}.Patient`) {
        for (let record of allRecords) {
            if (record.patient == currentParticipant) {
                relevantRecords.push(record);
            }
        }
        console.log(relevantRecords);
    	return relevantRecords;
    }

    if (getCurrentParticipant().getFullyQualifiedType() == `${NetworkNamespace}.CareProvider`) {
        for (let record of allRecords) {
            if (record.provider == currentParticipant) {
                relevantRecords.push(record);
            }
        }
        console.log(relevantRecords);
    	return relevantRecords;
    }
}