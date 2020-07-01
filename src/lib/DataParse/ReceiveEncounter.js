const FHIR = require('../../api/FHIR');
const formatDateTime = require('../unit').formatDateTime;
const formatTime = require('../unit').formatTime;
const makeReferenceList = require('../unit').makeReferenceList;

const idCollection = {
  patientId: null,
  practitionerId: null,
  encounterId: null,
  organizationId: '17',
  serviceRequestId: [],
  diagnosticReportId: null,
  medicationId: null,
  conditionId: [],
};

const outputResult = [];
module.exports = async (receiveObject) => {
  idCollection.patientId = await importPatient(receiveObject);
  idCollection.practitionerId = await importPractitioner(receiveObject);
  idCollection.encounterId = await importEncounter(receiveObject);
  idCollection.conditionId = await importCondition(receiveObject);
  idCollection.serviceRequestId = await importServiceRequest(receiveObject);
  idCollection.diagnosticReportId = await importDiagnosticReport(receiveObject);
  idCollection.medicationId = await importMedication(receiveObject);

  return outputResult;
};

async function importPatient(receiveObject) {
  let patientId = null;

  const checkId = await FHIR.getId(
    'Patient',
    receiveObject.meta.userId,
    'HospitalID'
  );
  if (checkId != null) {
    console.info('[Patient] succeed in finding');
    patientId = checkId;
  } else {
    const patient = parsePatient(receiveObject, idCollection);
    console.info('[Patient] import completed');
    patientId = await FHIR.postResource('Patient', patient);
  }

  return patientId;

  function parsePatient({ meta }, { organizationId }) {
    return {
      resourceType: 'Patient',
      identifier: [
        {
          use: 'official',
          system: 'HospitalID',
          value: meta.userId.trimReceive(),
        },
      ],
      managingOrganization: {
        reference: `Organization/${organizationId}`,
      },
    };
  }
}

async function importPractitioner(receiveObject) {
  let practitionerId = null;

  const checkId = await FHIR.getId(
    'Practitioner',
    receiveObject.meta.practitionerId
  );
  if (checkId != null) {
    practitionerId = checkId;
    console.info('[Practitioner] succeed in finding');
  } else {
    const practitioner = parsePractitioner(receiveObject);
    practitionerId = await FHIR.postResource('Practitioner', practitioner);
    outputResult.push(practitioner);
    console.info('[Practitioner] import completed');

    const practitionerRole = parsePractitionerRole(idCollection);
    await FHIR.postResource('PractitionerRole', practitionerRole);
    outputResult.push(practitionerRole);
    console.info('[PractitionerRole] import completed');
  }

  return practitionerId;

  function parsePractitioner({ meta }) {
    return {
      resourceType: 'Practitioner',
      identifier: {
        use: 'official',
        value: meta.practitionerId.trimReceive(),
      },
      active: 'true',
    };
  }

  function parsePractitionerRole({ organizationId, practitionerId }) {
    return {
      resourceType: 'PractitionerRole',
      practitioner: {
        reference: `Practitioner/${practitionerId}`,
      },
      organization: {
        reference: `Organization/${organizationId}`,
      },
    };
  }
}

async function importEncounter(receiveObject) {
  let encounterId = null;

  const checkId = await FHIR.getId('Encounter', receiveObject.encounterId);
  if (checkId != null) {
    encounterId = checkId;
    console.info('[Encounter] succeed in finding');
  } else {
    const encounter = parseEncounter(receiveObject, idCollection);
    encounterId = await FHIR.postResource('Encounter', encounter);
    outputResult.push(encounter);
    console.info('[Encounter] import completed');
  }

  return encounterId;

  function parseEncounter(
    { encounterId, meta },
    { patientId, organizationId, conditionId, practitionerId }
  ) {
    return {
      resourceType: 'Encounter',
      identifier: {
        use: 'official',
        value: encounterId.trimReceive(),
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      serviceType: {
        text: meta.serviceType.trimReceive(),
      },
      period: {
        start:
          meta.date.trimReceive() +
          'T' +
          formatTime(meta.diagTime.trimReceive()),
        end:
          meta.diagFinishTime.trimReceive() === ''
            ? ''
            : meta.date.trimReceive() +
              'T' +
              formatTime(meta.diagFinishTime.trimReceive()),
      },
      serviceProvider: {
        reference: `Organization/${organizationId}`,
      },
      participant: {
        individual: {
          reference: `Practitioner/${practitionerId}`,
        },
      },
    };
  }
}

async function importCondition(receiveObject) {
  const conditionIdList = [];

  const icdList = receiveObject.diagnostic.icd.filter(
    (icdCode) => icdCode !== ''
  );
  for (let i = 0; i < icdList.length; i++) {
    const condition = parseCondition(icdList[0], idCollection);
    const id = await FHIR.postResource('Condition', condition);
    conditionIdList.push(id);
    outputResult.push(condition);
    console.info('[Condition] import completed');
  }

  return conditionIdList;

  function parseCondition(icdCode, { patientId, encounterId, practitionerId }) {
    return {
      resourceType: 'Condition',
      code: {
        text: getIcdText(icdCode),
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      encounter: {
        reference: `Encounter/${encounterId}`,
      },
      recorder: {
        reference: `Practitioner/${practitionerId}`,
      },
    };

    function getIcdText() {
      // 查找 icd 中文名稱
      return 'IcdChineseName';
    }
  }
}

async function importServiceRequest(receiveObject) {
  const serviceRequestIdList = [];

  const serviceRequestList = receiveObject.serviceRequest;
  for (let i = 0; i < serviceRequestList.length; i++) {
    const serviceRequestId = await FHIR.getId(
      'ServiceRequest',
      serviceRequestList[i].serviceId
    );
    if (serviceRequestId != null) {
      serviceRequestIdList.push(serviceRequestId);
      console.info('[ServiceRequest] succeed in finding');
    } else {
      const serviceRequest = parseServiceRequest(
        serviceRequestList[i],
        idCollection
      );
      const id = await FHIR.postResource('ServiceRequest', serviceRequest);
      serviceRequestIdList.push(id);
      outputResult.push(serviceRequest);
      console.info('[ServiceRequest] import completed');
    }
  }

  return serviceRequestIdList;

  function parseServiceRequest(
    serviceRequest,
    { patientId, practitionerId, encounterId, organizationId }
  ) {
    return {
      resourceType: 'ServiceRequest',
      identifier: {
        use: 'official',
        value: serviceRequest.serviceId.trimReceive(),
      },
      status: 'completed',
      intent: 'order',
      code: {
        coding: {
          system: 'http://loinc.org',
          code: serviceRequest.code.loinc.trimReceive(),
        },
        text: serviceRequest.code.text.trimReceive(),
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      requester: {
        reference: `Practitioner/${practitionerId}`,
      },
      encounter: {
        reference: `Encounter/${encounterId}`,
      },
      performer: {
        reference: `Organization/${organizationId}`,
      },
      authoredOn: formatDateTime(serviceRequest.timestamp.trimReceive()),
      occurrenceDateTime: formatDateTime(
        serviceRequest.occurence.trimReceive()
      ),
    };
  }
}

async function importDiagnosticReport(receiveObject) {
  const diagnosticReport = parseDiagnosticReport(receiveObject, idCollection);
  const diagnosticReportId = await FHIR.postResource(
    'DiagnosticReport',
    diagnosticReport
  );
  outputResult.push(diagnosticReport);
  console.info('[DiagnosticReport] import completed');

  return diagnosticReportId;

  function parseDiagnosticReport(
    { meta, diagnostic },
    { serviceRequestId, patientId, encounterId, practitionerId }
  ) {
    return {
      resourceType: 'DiagnosticReport',
      status: 'final',
      code: {
        coding: {
          system: 'http://loinc.org',
          code: '10210-3',
          display: 'Physical findings of General status Narrative',
        },
      },
      effectiveDateTime:
        meta.date.trimReceive() + 'T' + formatTime(meta.diagTime.trimReceive()),
      basedOn: makeReferenceList('ServiceRequest', serviceRequestId),
      subject: {
        reference: `Patient/${patientId}`,
      },
      encounter: {
        reference: `Encounter/${encounterId}`,
      },
      resultsInterpreter: {
        reference: `Practitioner/${practitionerId}`,
      },
      conclusion: diagnostic.reason.trimReceive(),
    };
  }
}

async function importMedication(receiveObject) {
  const medicationRequestIdList = [];

  const medicationList = receiveObject.medication;
  for (let i = 0; i < medicationList.length; i++) {
    const medication = parseMedication(medicationList[i]);
    const medicationId = await FHIR.postResource('Medication', medication);
    outputResult.push(medication);

    const medicationRequest = parseMedicationRequest(medicationList[i], {
      medicationId,
      ...idCollection,
    });
    const medicationRequestId = await FHIR.postResource(
      'MedicationRequest',
      medicationRequest
    );
    medicationRequestIdList.push(medicationRequestId);
    outputResult.push(medicationRequest);
  }
  console.info('[Medication] import completed');
  console.info('[MedicationRequest] import completed');

  return medicationRequestIdList;

  function parseMedication(medication) {
    return {
      resourceType: 'Medication',
      identifier: {
        use: 'official',
        value: medication.drugId.trimReceive(),
      },
      code: {
        text: medication.drugName.trimReceive(),
      },
    };
  }

  function parseMedicationRequest(
    medication,
    { medicationId, patientId, encounterId, practitionerId, serviceRequestId }
  ) {
    return {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medication: {
        reference: `Medication/${medicationId}`,
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      encounter: {
        reference: `Encounter/${encounterId}`,
      },
      recorder: {
        reference: `Practitioner/${practitionerId}`,
      },
      basedOn: {
        reference: `ServiceRequest/${serviceRequestId}`,
      },
      note: {
        text: medication.note.trimReceive(),
      },
      dosageInstruction: {
        text: medication.method.trimReceive(),
      },
      dispenseRequest: {
        dispenseInterval: {
          value: medication.timing.trimReceive(),
          unit: 'days',
          system: 'http://unitsofmeasure.org',
          code: 'd',
        },
        quantity: {
          value: medication.total.trimReceive(),
          unit: 'TAB',
          system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
          code: 'TAB',
        },
        expectedSupplyDuration: {
          value: medication.days.trimReceive(),
          unit: 'days',
          system: 'http://unitsofmeasure.org',
          code: 'd',
        },
      },
    };
  }
}
