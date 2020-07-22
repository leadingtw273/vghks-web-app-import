const FHIR = require('../../api/FHIR');
const fs = require('fs');
const formatDateTime = require('../unit').formatDateTime;
const formatTime = require('../unit').formatTime;

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
  idCollection.medicationId = await importMedication(receiveObject);
  return { outputResult, idCollection };
};

function randomId(len) {
  len = len || 8;
  var chars = '0123456789';
  var maxPos = chars.length;
  var str = '';
  for (i = 0; i < len; i++) {
    str += chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return 'auto_' + str;
}

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
    patientId = await FHIR.postResource('Patient', patient);
    console.info('[Patient] import completed');
    outputResult.push(patient);
  }

  return patientId;

  function parsePatient({ meta }, { organizationId }) {
    return {
      resourceType: 'Patient',
      identifier: [
        {
          use: 'official',
          system: 'HospitalID',
          value: meta.userId.trim(),
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

    const practitionerRole = parsePractitionerRole({
      ...idCollection,
      practitionerId,
    });
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
        value: meta.practitionerId.trim(),
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
    { patientId, organizationId, practitionerId }
  ) {
    const startPeriod = formatPeriodTime(meta.date, meta.diagTime);

    function formatPeriodTime(date, time) {
      if (time === '') return '';

      return date.trim() + 'T' + formatTime(time.trim());
    }

    return {
      resourceType: 'Encounter',
      identifier: {
        use: 'official',
        value: encounterId.trim() || randomId(),
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      serviceType: {
        text: meta.serviceType.trim(),
      },
      period: {
        start: startPeriod === '' ? '' : startPeriod,
        end: startPeriod === '' ? '' : startPeriod,
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

  const reason = {
    resourceType: 'Condition',
    note: {
      author: {
        reference: `Practitioner/${idCollection.practitionerId}`,
      },
      text: receiveObject.diagnostic.reason,
    },
    subject: {
      reference: `Patient/${idCollection.patientId}`,
    },
    encounter: {
      reference: `Encounter/${idCollection.encounterId}`,
    },
    recorder: {
      reference: `Practitioner/${idCollection.practitionerId}`,
    },
  };

  const id = await FHIR.postResource('Condition', reason);
  conditionIdList.push(id);
  outputResult.push(reason);
  console.info('[Condition] import completed');

  const icdList = receiveObject.diagnostic.icd.filter(
    (icdCode) => icdCode !== ''
  );
  for (let i = 0; i < icdList.length; i++) {
    const condition = parseCondition(icdList[i], idCollection);
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
        coding: {
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: icdCode,
          display: getIcdText(icdCode) === '' ? '' : getIcdText(icdCode),
        },
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

    function getIcdText(icdCode) {
      // 查找 icd 中文名稱
      const icdList = {
        'N18.4': {
          en: 'Chronic kidney disease, stage 4 (severe)',
          zh: '第四期慢性腎臟疾病(重度)',
        },
        'I13.10': {
          en:
            'Hypertensive heart and chronic kidney disease without heart failure, with stage 1 through stage 4 chronic kidney disease, or unspecified chronic kidney disease',
          zh:
            '高血壓性心臟及慢性腎臟病未伴有心臟衰竭合併第一至第四期慢性腎病或未明示慢性腎病',
        },
        'L03.115': {
          en: 'Cellulitis of right lower limb',
          zh: '右側下肢蜂窩組織炎',
        },
        'E11.9': {
          en: 'Type 2 diabetes mellitus without complications',
          zh: '第二型糖尿病，未伴有併發症',
        },
        'I25.10': {
          en:
            'Atherosclerotic heart disease of native coronary artery without angina pectoris',
          zh: '自體的冠狀動脈粥樣硬化心臟病未伴有心絞痛',
        },
        'E78.4': {
          en: 'Other hyperlipidemia',
          zh: '其他高血脂症',
        },
        'N18.3': {
          en: 'Chronic kidney disease, stage 3 (moderate)',
          zh: '第三期慢性腎臟疾病(中度)',
        },
        I10: {
          en: 'Essential (primary) hypertension',
          zh: '本態性(原發性)高血壓',
        },
        'E11.65': {
          en: 'Type 2 diabetes mellitus with hyperglycemia',
          zh: '第二型糖尿病，伴有高血糖',
        },
        'I12.9': {
          en:
            'Hypertensive chronic kidney disease with stage 1 through stage 4 chronic kidney disease, or unspecified chronic kidney disease',
          zh: '高血壓性慢性腎臟病伴有第一至第四期慢性腎病或未明示慢性腎病',
        },
        'I34.0': {
          en: 'Nonrheumatic mitral (valve) insufficiency',
          zh: '非風濕性二尖瓣閉鎖不全',
        },
        'I44.0': {
          en: 'Atrioventricular block, first degree',
          zh: '第一度房室傳導阻滯',
        },
        'I50.9': {
          en: 'Heart failure, unspecified',
          zh: '心臟衰竭',
        },
        'E11.22': {
          en: 'Type 2 diabetes mellitus with diabetic chronic kidney disease',
          zh: '第二型糖尿病，糖尿病的慢性腎臟疾病',
        },
        'N18.6': {
          en: 'End stage renal disease',
          zh: '末期腎疾病',
        },
        'E11.8': {
          en: 'Type 2 diabetes mellitus with unspecified complications',
          zh: '第二型糖尿病，伴有未明示之併發症',
        },
        'E78.1': {
          en: 'Pure hyperglyceridemia',
          zh: '純高三酸甘油酯血症',
        },
        'E08.40': {
          en:
            'Diabetes mellitus due to underlying condition with diabetic neuropathy, unspecified',
          zh: '起因於潛在病的糖尿病，伴有糖尿病的神經病變',
        },
        'M79.2': {
          en: 'Neuralgia and neuritis, unspecified',
          zh: '神經痛及神經炎',
        },
        'M16.0': {
          en: 'Bilateral primary osteoarthritis of hip',
          zh: '髖部原發性骨關節炎，雙側性',
        },
        'M60.859': {
          en: 'Other myositis, unspecified thigh',
          zh: '未明示側性大腿其他肌炎',
        },
        'H34.812': {
          en: 'Central retinal vein occlusion, left eye',
          zh: '左側眼中心視網膜靜脈阻塞',
        },
        'H25.9': {
          en: 'Unspecified age-related cataract',
          zh: '老年性白內障',
        },
        'H40.89': {
          en: 'Other specified glaucoma',
          zh: '其他特定青光眼',
        },
        'H04.123': {
          en: 'Dry eye syndrome of bilateral lacrimal glands',
          zh: '雙側淚腺乾眼症',
        },
        'E08.00': {
          en:
            'Diabetes mellitus due to underlying condition with hyperosmolarity without nonketotic',
          zh:
            '起因於潛在病的糖尿病，伴有高滲透壓，未伴有非酮病之高血糖-高滲透壓的昏迷',
        },
      };

      return icdCode === '' ? '' : icdList[icdCode].zh;
    }
  }
}

async function importServiceRequest(receiveObject) {
  const serviceRequestIdList = [];

  const serviceRequestList = receiveObject.serviceRequest.filter(
    ({ rtnCode }) => rtnCode !== '02'
  );

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
        value: serviceRequest.serviceId.trim(),
      },
      status: 'completed',
      intent: 'order',
      code: {
        coding: {
          system: 'http://loinc.org',
          code: serviceRequest.code.loinc.trim(),
        },
        text: serviceRequest.code.text.trim(),
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
      authoredOn: formatDateTime(serviceRequest.timestamp.trim()),
      occurrenceDateTime: formatDateTime(serviceRequest.occurence.trim()),
    };
  }
}

async function importMedication(receiveObject) {
  const medicationRequestIdList = [];

  const medicationList = receiveObject.medication.filter(
    ({ rtnCode }) => rtnCode !== '02'
  );

  for (let i = 0; i < medicationList.length; i++) {
    const medication = parseMedication(medicationList[i]);

    let medicationId = null;
    const checkId = await FHIR.getId(
      'Medication',
      medicationList[i].drugId.split(' / ')[0]
    );
    if (checkId != null) {
      medicationId = checkId;
      console.info('[Medication] succeed in finding');
    } else {
      medicationId = await FHIR.postResource('Medication', medication);
      console.info('[Medication] import completed');
    }

    outputResult.push(medication);

    const medicationRequest = parseMedicationRequest(medicationList[i], {
      ...idCollection,
      medicationId,
    });
    const medicationRequestId = await FHIR.postResource(
      'MedicationRequest',
      medicationRequest
    );
    medicationRequestIdList.push(medicationRequestId);
    outputResult.push(medicationRequest);
    console.info('[MedicationRequest] import completed');
  }

  return medicationRequestIdList;

  function parseMedication(medication) {
    const [NHI, HospitalID] = medication.drugId.split(' / ');

    const medicationMap = JSON.parse(fs.readFileSync('file/medication.json'));

    return {
      resourceType: 'Medication',
      identifier: [
        {
          use: 'official',
          system: 'NHI',
          value: NHI,
        },
        {
          use: 'official',
          system: 'HospitalID',
          value: HospitalID,
        },
      ],
      code: {
        text: medicationMap[NHI] == null ? '' : medicationMap[NHI].name,
      },
    };
  }

  function parseMedicationRequest(
    medication,
    { medicationId, patientId, encounterId, practitionerId, serviceRequestId }
  ) {
    const timingMap = {
      BID: '一天兩次',
      TID: '一天三次',
      QID: '一天四次',
      AM: '每天早上',
      PM: '每天下午',
      QD: '一天一次',
      QOD: '隔天',
      Q1H: '每小時',
      Q2H: '每兩小時',
      Q3H: '每三小時',
      Q4H: '每四小時',
      Q6H: '每六小時',
      Q8H: '每八小時',
      BED: '睡前',
      WK: '一週一次',
      MO: '一個月一次',
    };
    return {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medicationReference: {
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
      note: {
        text: medication.note.trim(),
      },
      dosageInstruction: {
        method: {
          coding: {
            display: medication.method.trim(),
          },
        },
        timing: {
          code: {
            coding: {
              system:
                'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
              code: medication.timing.trim(),
              display: timingMap[medication.timing.trim()],
            },
          },
          repeat: {
            boundsDuration: {
              value: medication.days.trim(),
              unit: 'd',
            },
          },
        },
      },
      dispenseRequest: {
        quantity: {
          value: formatTotal(medication.total.trim()).value,
          unit: formatTotal(medication.total.trim()).unit,
          system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
          code: formatTotal(medication.total.trim()).unit,
        },
      },
    };
  }

  function formatTotal(total) {
    const [value, unit] = total.split(' / ');
    return { value, unit };
  }
}
