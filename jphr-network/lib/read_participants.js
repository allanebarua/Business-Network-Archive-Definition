'use strict';


/**
 * Transaction processor function.
 * @param {org.jphr.network.ReadProviders} trans create transaction instance.
 * @transaction
 */
async function ReadProviders(trans) {

    let providerRegistry  = await getParticipantRegistry(`${NetworkNamespace}.CareProvider`);
    let providers = await providerRegistry.getAll();
    var authRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
    let returnData = []

    for (let provider of providers) {
        // Check if authorized
        let authBlock = await authRegistry.get(getCurrentParticipant().getIdentifier())
        let authIndex = await getAuthIndex(authBlock, provider.getIdentifier())

        if (authIndex != -1) {
            returnData.push(provider)
        }
    }

    console.log(returnData);
    return returnData
}


/**
 * Transaction processor function.
 * @param {org.jphr.network.ReadPatients} trans create transaction instance.
 * @transaction
 */
async function ReadPatients(trans) {

    let patientRegistry  = await getParticipantRegistry(`${NetworkNamespace}.Patient`);
    let patients = await patientRegistry.getAll();
    var authRegistry = await getAssetRegistry(`${NetworkNamespace}.AuthorizationBlock`);
    let returnData = []

    for (let patient of patients) {
        // Check if authorized
        let authBlock = await authRegistry.get(patient.getIdentifier())
        let authIndex = await getAuthIndex(authBlock, getCurrentParticipant().getIdentifier())

        if (authIndex != -1) {
            returnData.push(patient)
        }
    }

    console.log(returnData);
    return returnData
}