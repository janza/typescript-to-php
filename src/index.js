#!/usr/bin/env node

const { resolve, join } = require('path')
const fs = require('fs')
const TJS = require('typescript-json-schema')
const {request, response} = require('./classBuilder')

const namespace = 'InSided\\Endpoints'

const fileName = process.argv[2]
const endpointName = process.argv[3]
const outputDir = process.argv[4]
const requestOrResponse = process.argv[5]

if (!fileName) throw new Error('Missing filename to process')
if (!endpointName) throw new Error('Missing endpoint name')
if (!outputDir) throw new Error('Missing output directory')
if (requestOrResponse !== undefined &&
  requestOrResponse !== 'request' &&
  requestOrResponse !== 'response'
) throw new Error(`Either "response" or "request" is allowed, not ${requestOrResponse}`)

const program = TJS.getProgramFromFiles([resolve(fileName)])
const endpointSchema = TJS.generateSchema(program, endpointName)
if (!endpointSchema) throw new Error(`Failed to find ${endpointName}`)

function jsToPhpTypeName (typename) {
  if (typename === 'boolean') return 'bool'
  return typename
}

function resolveParameters (parametersSchema) {
  const parameters = []
  if (parametersSchema) {
    Object.keys(parametersSchema).forEach(name => {
      const schema = parametersSchema[name]
      if (schema.type === 'object') {
        parameters.push([resolveParameters(schema.properties), name])
        return
      }
      parameters.push([jsToPhpTypeName(schema.type), name])
    })
  }
  return parameters
}

function generateRequestClass (endpointSchema) {
  const method = endpointSchema.properties.method.enum[0]
  const url = endpointSchema.properties.url.enum[0]
  return request(
    namespace,
    endpointName,
    method,
    url,
    resolveParameters(endpointSchema.properties.parameters.properties)
  )
}

function generateResponseClass (endpointSchema) {
  return response(
    namespace,
    endpointName,
    200,
    resolveParameters(endpointSchema.properties.successResponse.properties)
  )
}
const isResponse = requestOrResponse === 'response'

var output = ''
if (isResponse) {
  output = generateResponseClass(endpointSchema)
} else {
  output = generateRequestClass(endpointSchema)
}

fs.writeFileSync(resolve(join(outputDir, endpointName + (isResponse ? 'Response' : 'Request') + '.php')), output)
