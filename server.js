const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
//const sdkModulo = require('sdk-node-payway');
const sdkModulo = require('./libs/sdk-node-ventaonline-2.0.0');

// Cargar variables de entorno
dotenv.config();

// Inicializar app
const app = express();

// Middleware para parsear JSON
app.use(bodyParser.json());

// Configuración de Payway
const ambient = process.env.PAYWAY_AMBIENT || 'developer'; // 'developer' o 'production'
const publicKey = process.env.PAYWAY_PUBLIC_KEY;
const privateKey = process.env.PAYWAY_PRIVATE_KEY;
const company = process.env.PAYWAY_COMPANY;
const user = process.env.PAYWAY_USER;
const siteId = process.env.PAYWAY_SITE_ID;

// Endpoint de prueba
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Payway service is running',
    config: {
      ambient, 
      company, 
      user, 
      siteId,
      publicKey: publicKey ? '******' : 'Not configured',
      privateKey: privateKey ? '******' : 'Not configured'
    }
  });
});

// Endpoint para generar el hash de checkout
app.post('/checkout-hash', async (req, res) => {
  try {
    console.log('Generating checkout hash with data:', req.body, ambient, publicKey, privateKey, company, user);
    
    const sdk = new sdkModulo.sdk(ambient, publicKey, privateKey, company, user);

    // Ejemplo de implementación correcta
// await sdk.healthcheck((error, response) => {
//     console.log("entraaa")
//     if (error) {
//       console.log("Healthcheck error:", error);
//     } else {
//       console.log("Healthcheck OK:", response);
//     }
//   });
    
    // Validar que los datos necesarios están presentes
    const { description, amount, school_amount, fee_amount, success_url, redirect_url, cancel_url } = req.body;
    
    if (!amount || !success_url || !cancel_url) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['amount', 'success_url', 'cancel_url'] 
      });
    }
    
    // Verificar que la suma de los montos coincide con el total
    const totalAmount = parseFloat(amount);
    const schoolAmount = parseFloat(school_amount || 0);
    const feeAmount = parseFloat(fee_amount || 0);
    
    if (schoolAmount + feeAmount !== totalAmount) {
      return res.status(400).json({ 
        error: 'The sum of school_amount and fee_amount must equal the total amount',
        totalAmount,
        schoolAmount,
        feeAmount,
        sum: schoolAmount + feeAmount
      });
    }
    
    // Datos para generar el hash
    const args = {
      origin_platform: "SDK-Node",
      //payment_description: description || "Pago de cuota escolar",
      currency: "ARS",
      //   "products": [
      //     {
      //       "id": req.body.payment_id || 1,
      //       "value": schoolAmount,
      //       "description": req.body.school_description || "Cuota escolar",
      //       "quantity": 1
      //     }
      //   ],
      "products": [
        {
          "id": 46, // Nuevo ID para el fee
          "description": "Cargo administrativo",
          "value": 14000,
          "quantity": 1,
        },
      ],
      total_price: totalAmount,
      site: siteId,
      success_url: success_url,
      //redirect_url: redirect_url || success_url,
      cancel_url: cancel_url,
      template_id: 1,
      installments: [1], // Solo una cuota
      id_payment_method: req.body.payment_method_id || 1, // Default: tarjeta de débito
      plan_gobierno: false,
      public_apikey: publicKey,
      auth_3ds: false,
      life_time: 3600, // 1 hora
    };

    console.log("llamo checkkk")
    // const result = await sdk.healthcheck();
    // console.log("result", result)

    // const hola = await sdk.healthcheck(args, function(result, err) {
        
    //     console.log("-----------------------------------------");
    //     console.log("healthcheck result:");
    //     console.log(result);
    //     console.log("-----------------------------------------");
    //     console.log("healthcheck error:");
    //     console.log(err);
    //     console.log("-------------------***-------------------");
    // });


    

    // console.log("holaaaaaaaaaaa", hola2)
    
    // Agregar el fee como un producto adicional si existe
    if (feeAmount > 0) {
      args.products.push({
        "id": 10,
        "value": feeAmount,
        "description": req.body.fee_description || "Cargo por servicio",
        "quantity": 1
      });
    }
    
    console.log('Calling Payway SDK with args:', JSON.stringify(args, null, 2));
    
    // Llamar al SDK para generar el hash
    try {
    //   const checkout = await sdk.checkout(sdk, args);
    //   const result = await checkout;

    let url


      var checkout = await  sdk.checkout(args ,function(result, err) {
        
        console.log("-----------------------------------------");
        console.log("healthcheck tokens result:");
        console.log(result);
        url = `https://live.decidir.com/web/forms/${result.payment_id}?apikey=${process.env.PAYWAY_PUBLIC_KEY}`;

        console.log("url", url)
        
        console.log("-----------------------------------------");
        console.log("healthcheck tokens error:");
        console.log(err);
        console.log("-------------------***-------------------");
    });

    //const sdk = new sdkModulo.sdk(ambient, publicKey, privateKey, company, user);

            // var checkout = new sdk.checkoutHash(sdk, args).then(function(result) {
            //     console.log("-----------------------------------------")
            //     console.log("Link Hash")
            //     console.log("-------------------***-------------------");
            // })

          
          //   var checkout = sdk.checkout(sdk, args).then(function(result) {
          //     console.log("-----------------------------------------")
          //     console.log("Link Hash")
          //     console.log("-------------------***-------------------");
          // })

    // sdk.paymentInfo('6EB705C98F357B8D72DF2B5C9F574649', function(result, err) {
    //   console.log("");
    //   console.log("información de pago previamente realizado");
    //   console.log("");
    //   console.log(result);
    //   console.log("-----------------------------------------");
    //   console.log("error:");
    //   console.log(err);
    //   });
      
      console.log('Hash generated successfully:', result, response);
      
      // Construir la URL del formulario
      // const formUrl = `https://api.decidir.com/web/form?hash=${result.hash}`;
      const formUrl = `https://live.decidir.com/web/forms/${response.payment_id}?apikey=${process.env.PAYWAY_PUBLIC_KEY}`;
      
      
      res.status(200).json({
        hash: result.hash,
        form_url: formUrl
      });
    } catch (sdkError) {
      console.error('SDK Error:', sdkError);
      res.status(500).json({ error: 'Error generating hash', details: sdkError.message });
    }
  } catch (error) {
    console.error('Error generating hash:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Payway service running on port ${PORT}`);
});